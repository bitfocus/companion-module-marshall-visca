class PacketFamily {
    constructor(name, prefix, postfix, type) {
        this.name = name
        this.prefix = prefix
        this.postfix = postfix
        this.type = type
    }

    createChildFamily(name, prefix, postfix, type=this.type) {
        const newPrefix = Pattern.concat(this.prefix, prefix)
        const newPostfix = Pattern.concat(postfix, this.postfix)

        return new PacketFamily(name, newPrefix, newPostfix, type)
    }

    createChild(name, core, comment, type=this.type) {
        const pattern = Pattern.concat(this.prefix, core, this.postfix)
        
        return new Packet(name, this.name, type, pattern, comment)
    }
}

class CommandFamily extends PacketFamily {
    constructor(name, prefix, postfix, type, replies=[], replyFamily)  {
        super(name, prefix, postfix, type)

        this.replies = replies
        this.replyFamily = replyFamily
    }

    createChildFamily(name, prefix, postfix, type=this.type, replies=[], replyPrefix, replyPostfix) {
        const childPrefix = Pattern.concat(this.prefix, prefix)
        const childPostfix = Pattern.concat(postfix, this.postfix)

        const childReplies = [...this.replies, ...replies]
        
        const childReplyFamily = this.replyFamily.createChildFamily(replyPrefix, replyPostfix)
        
        return new CommandFamily(name, childPrefix, childPostfix, type, childReplies, childReplyFamily)
    }

    createChild(name, core, comment, type=this.type, replies=[]) {
        const pattern = Pattern.concat(this.prefix, core, this.postfix)
        
        const childReplies = [...this.replies, ...replies]
        
        return new Command(name, this.name, type, pattern, comment, childReplies)
    }
}

const PacketTypes = Object.freeze({
    ERROR: Symbol('Error'),
    ACK: Symbol('Ack'),
    COMPLETION: Symbol('Completion'),
    ANSWER: Symbol('Answer'),
    TASK: Symbol('Task'),
    INQUERY: Symbol('Inquery'),
    DEVICE_SETTING_COMMAND: Symbol('Device Setting Command')
})

class Packet {
    static get TYPES() {
        return PacketTypes
    }

    constructor(name, familyName, type, pattern, comment) {
        this.name = name
        this.familyName = familyName
        this.type = type
        this.pattern = pattern
        this.comment = comment
    }
}

class Command extends Packet {
    constructor(name, familiyName, type, pattern, comment, replies) {
        super(name, familiyName, type, pattern, comment)
        this.replies = replies
    }
}

class Match {
    constructor(markers, parameterGroup) {
        if (markers.length !== parameterGroup.nHex)
            throw Error(`The number of markers (${markers.length}) does not match the number of hexadecimal digits of the parameter group: ${parameterGroup.nHex}`)
        if (typeof markers === 'string') {
            markers = markers.split('')
        }
        for(const marker of markers) {
            if (!isNaN(parseInt(marker, 16)) || marker === ' ') {
                throw Error(`Unvalid marker: ${marker}`)
            }
        }
        this.markers = markers
        this.parameterGroup = parameterGroup
    }
}

class Pattern {
    constructor(patternString, matchArray=[]) {
        const charArray = patternString.replace(/\s+/g, '').split('')
        if (matchArray instanceof Match) {
            matchArray = [ matchArray ]
        }
        const markerDict = {}
        this.parameterGroups = new Set()
        
        for (const match of matchArray) {
            this.parameterGroups.add(match.parameterGroup)

            for (const [idx, marker] of match.markers.entries()) {
                if (!(marker in markerDict)) {
                    markerDict[marker] = []
                }
                markerDict[marker].push({
                    parameterGroup: match.parameterGroup,
                    idx: idx,
                })
            }
        }
        
        this.hexPayloadTemplate = charArray.map((char) => {
            const hex = parseInt(char, 16)
            if (isNaN(hex)) {
                if (!markerDict[char].length) { throw new Error('Pattern string and match array do not fit')}
                return markerDict[char].shift()
            } else {
                return hex
            }
        })

        for (const charMatch of Object.values(markerDict)) {
            if (charMatch.length) { throw new Error('Pattern string and match array do not fit')}
        }
    }

    static fromParameterGroup(parameterGroup) {
        const patternString = '_'.repeat(parameterGroup.nHex)
        return new Pattern(patternString, new Match(patternString, parameterGroup))
    }

    writePayload(parameterDict) {
        const parameterGroupsHexArray = new Map()

        for (const parameterGroup of this.parameterGroups) {
            parameterGroupsHexArray.set(parameterGroup, parameterGroup.encoder(parameterDict))
        }

        const hexPayload = this.hexPayloadTemplate.map(element => {
            if (typeof element === 'number') {
                return element
            } else {
                return parameterGroupsHexArray.get(element.parameterGroup)[element.idx]
            }
        })

        const payload = hexPayload.flatMap((halfByte, idx, hexPayload) => 
            (idx % 2) ? [ 0x10 * hexPayload[idx-1] + hexPayload[idx] ] : []
        )

        return payload
    } 
    
    readPayload(payload) {
        if (payload.length * 2 !== this.hexPayloadTemplate.length) { throw Error('Pattern has not the same length as the payload')}

        const hexPayload = payload.flatMap(byte => [ Math.floor(byte / 0x10), byte % 0x10 ])

        const parameterGroupsHexArray = new Map()
        
        for (const parameterGroup of this.parameterGroups) {
            parameterGroupsHexArray.set(parameterGroup, [])
        }
        
        for (const [idx, element] of this.hexPayloadTemplate.entries()) {
            if (typeof element === 'number') {
                if (hexPayload[idx] !== element) {
                    throw Error('Payload does not match the template')
                }
            } else {
                parameterGroupsHexArray.get(element.parameterGroup)[element.idx] = hexPayload[idx]
            }
        }
        
        let parameterDict = {}
        for (const [parameterGroup, hexArray] of parameterGroupsHexArray) {
            parameterDict = {...parameterDict, ...parameterGroup.decoder(hexArray)}
        }
        
        return parameterDict
    }

    static concat(...patternArray) { // should handle 'undefined' and n>=0 arguments
        const newPattern = new Pattern('', [])
        
        for (const pattern of patternArray) {
            if (pattern === undefined) { continue }
            newPattern.hexPayloadTemplate.push(...pattern.hexPayloadTemplate)
            for (const parameterGroup of pattern.parameterGroups)
                newPattern.parameterGroups.add(parameterGroup)
        }

        return newPattern
    }
}

module.exports = {
    Pattern,
    Match,
    CommandFamily: CommandFamily,
    Command,
    PacketFamily,
    Packet
}