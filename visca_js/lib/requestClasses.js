const utils = require('./utils')

class Parameter {
    static fromOptions({ name, comment }) {
        return new this(name, comment)
    }

    constructor(name, comment) {
        this.name = name
        this.comment = comment
    }

    validate() {
        throw Error('Function not implemented')
    }

    defaultNHex({}) {
        return 1
    }

    defaultEncoder(nHex, {}) {
        return () => Array(nHex)
    }

    defaultDecoder({}) {
        return () => ({ [this.name]: undefined })
    }

    createCoder({ encoder, decoder, nHex }, options={}) {
        if (typeof nHex === 'undefined') {
            nHex = this.defaultNHex(options)
        }
        if (typeof encoder === 'undefined') {
            encoder = this.defaultEncoder(nHex, options)
        }
        if (typeof decoder === 'undefined') {
            decoder = this.defaultDecoder(options)
        }
        return { encoder: encoder, decoder: decoder, nHex: nHex }
    }
}

class Range extends Parameter {
    static fromOptions({ name, min, max, comment }) {
        return new this(name, min, max, comment)
    }
    
    constructor(name, min, max, comment) {
        super(name, comment)
        
        if (!(min <= max)) {
            // This error is also thrown when one of the values is undefined
            throw new TypeError('The minimum value must be smaller or equal the maximum value')
        }
        this.min = min
        this.max = max
    }

    validate(value) {
        return (value >= this.min && value <= this.max)
    }

    defaultNHex() {
        return this.max.toString(16).length
    }

    defaultEncoder(nHex, {}) {
        return parameterDict => {
            let value = parameterDict[this.name]
            let hexArray = utils.uintToHexArray(value, nHex)
            return hexArray
        }
    }

    defaultDecoder({}) {
        return hexArray => {
            let value = utils.hexArrayToUint(hexArray)
            let parameterDict = { [this.name]: value }
            return parameterDict
        }
    }
}

class List extends Parameter {
    static fromOptions({ name, itemNameArray, itemArray, comment }) {
        if (typeof itemNameArray === 'undefined') {
            itemNameArray = utils.itemArrayToValueArray(itemArray, 'name')
        }
        return new this(name, itemNameArray, comment)
    }
    
    constructor(name, itemNameArray, comment) {
        super(name, comment)

        this.itemNameArray = itemNameArray
    }

    validate(value) {
        return this.itemNameArray.includes(value)
    }

    defaultNHex({ itemArray }) {
        return Math.max(...itemArray.map(item => item.value.toString(16).length))
    }

    defaultEncoder(nHex, { itemArray }) {
        return parameterDict => {
            let itemName = parameterDict[this.name]
            let item = utils.getObjectByKeyValuePair(itemArray, 'name', itemName)
            let hexArray = utils.uintToHexArray(item.value, nHex)
            return hexArray
        }
    }

    defaultDecoder({ itemArray }) {
        return hexArray => {
            let itemValue = utils.hexArrayToUint(hexArray)
            let item = utils.getObjectByKeyValuePair(itemArray, 'value', itemValue)
            let parameterDict = { [this.name]: item.name}
            return parameterDict
        }
    }
}

class HexLiteral extends Parameter {
    static fromOptions({ name, nHex, comment }) {
        return new this(name, nHex, comment)
    }
    
    constructor(name, nHex, comment) {
        super(name, comment)
    
        this.nHex = nHex
    }

    validate(value) {
        let hexArray = utils.hexStringToHexArray(value)
        let byteArray = utils.hexArrayToByteArray(hexArray)
        return hexArray.length === this.nHex && !hexArray.includes(NaN) && !byteArray.includes(0xFF)
    }
    
    defaultNHex() {
        return this.nHex
    }

    defaultEncoder(nHex) {
        return parameterDict => {
            let hexString = parameterDict[this.name]
            let hexArray = utils.hexStringToHexArray(hexString).slice(0, nHex)
            return hexArray
        }
    }
    
    defaultDecoder({ spacer='' }) {
        return hexArray => {
            let hexString = utils.hexArrayToHexString(hexArray, spacer)
            let parameterDict = { [this.name]: hexString}
            return parameterDict
        }
    }
}

class IPv4 extends Parameter {
    static fromOptions({ name, comment }) {
        return new this(name, comment)
    }
    
    constructor(name, comment) {
        super(name, comment)
    }

    validate(value) {
        let oktetStringArray = value.split('.')
        let oktetArray = oktetStringArray.map(oktetString => Number(oktetString))
        return oktetArray.length === 4 && oktetArray.every(oktet => oktet >= 0x00 && oktet <= 0xFF)
    }
    
    defaultNHex() {
        return 4
    }

    defaultEncoder(_nHex) {
        return parameterDict => {
            let ipv4String = parameterDict[this.name]
            let oktetStringArray = ipv4String.split('.')
            let oktetArray = oktetStringArray.map(oktetString => Number(oktetString))
            let hexArray = utils.byteArrayToHexArray(oktetArray)
            return hexArray
        }
    }
    
    defaultDecoder({}) {
        return hexArray => {
            let oktetArray = utils.hexArrayToByteArray(hexArray)
            let oktetStringArray = oktetArray.map(oktet => String(oktet))
            let ipv4String = oktetStringArray.join('.')
            let parameterDict = { [this.name]: ipv4String}
            return parameterDict
        }
    }
}

class AsciiString extends Parameter {
    static fromOptions({ name, nCharacters, comment }) {
        return new this(name, nCharacters, comment)
    }
    
    constructor(name, nCharacters, comment) {
        super(name, comment)

        this.nCharacters = nCharacters
    }

    validate(value) {
        return value.length === this.nCharacters && /^[\x00-\x7F]*$/.test(value)
    }
    
    defaultNHex() {
        return this.nCharacters
    }

    defaultEncoder(_nHex) {
        return parameterDict => {
            let string = parameterDict[this.name]
            let characterArray = string.split('')
            let byteArray = characterArray.map(character => character.charCodeAt(0))
            let hexArray = utils.byteArrayToHexArray(byteArray)
            return hexArray
        }
    }
    
    defaultDecoder({}) {
        return hexArray => {
            let byteArray = utils.hexArrayToByteArray(hexArray)
            let characterArray = byteArray.map(byte => String.fromCharCode(byte))
            let string = characterArray.join('')
            let parameterDict = { [this.name]: string}
            return parameterDict
        }
    }
}

class ParameterGroup {
    static fromParameterClass(ParameterClass, options) {
        let parameter = ParameterClass.fromOptions(options)
        let coder = {
            nHex: options.nHex,
            encoder: options.encoder,
            decoder: options.decoder
        }
        return this.fromParameter(parameter, coder, options)
    }

    static fromParameter(parameter, coder={}, options={}) {
        return new this.prototype.constructor(parameter, parameter.createCoder(coder, options))
    }

    constructor(parameterArray, { encoder, decoder, nHex }) {
        if (parameterArray instanceof Parameter) {
            this.parameterArray = [ parameterArray ]
        } else {
            this.parameterArray = parameterArray
        }
        this.nHex = nHex
        this._encoder = encoder
        this._decoder = decoder
    }

    encoder(parameterDict) {
        if (typeof this._encoder === 'undefined') { throw Error('No encoder implemented for this parameter group') }
        this.verifyParameterDict(parameterDict)
        try {
            var hexArray = this._encoder(parameterDict)
        } catch (error) {
            throw Error(`Encoding failed: ${parameterDict}`)
        }
        this.verifyHexArray(hexArray)
        return hexArray
    }

    decoder(hexArray) {
        this.verifyHexArray(hexArray)
        if (typeof this._decoder === 'undefined') { throw Error('No decoder implemented for this parameter group') }
        try {
            var parameterDict = this._decoder(hexArray)
        } catch (error) {
            throw Error(`Decoding failed: ${hexArray}`)
        }
        this.verifyParameterDict(parameterDict)
        return parameterDict
    }

    verifyHexArray(hexArray) {
        if (hexArray.length !== this.nHex)
        if (hexArray.some(hexDigit => hexDigit > 0xF)) { throw Error(`Array contains values greater than ${0xF}`)}
    }

    verifyParameterDict(parameterDict) {
        for (const parameter of this.parameterArray) {
            let value = parameterDict[parameter.name]
            if (typeof value === 'undefined') { throw Error(`Parameter not found in parameter dict: ${parameter.name}`)}
            if (!parameter.validate(value)) { throw Error(`Parameter for ${parameter.name} invalid: ${value}`)}
        }
    }
}

class PacketStruct {
    constructor(prefix, postfix) {
        this.prefix = prefix
        this.postfix = postfix
    }

    createChildStruct(prefix, postfix) {
        const newPrefix = Pattern.concat(this.prefix, prefix)
        const newPostfix = Pattern.concat(postfix, this.postfix)

        return PacketStruct(newPrefix, newPostfix)
    }

    createChild(core) {
        const pattern = Pattern.concat(this.prefix, core, this.postfix)
        
        return Packet(pattern)
    }
}

class CallStruct extends PacketStruct {
    constructor(prefix, postfix, answers=[], errors=[], answerStruct, errorStruct)  {
        super(prefix, postfix)

        this.answers = answers
        this.errors = errors
        this.answerStruct = answerStruct
        this.errorStruct = errorStruct
    }

    createChildStruct(prefix, postfix, answers=[], errors=[], answerPrefix, answerPostfix, errorPrefix, errorPostfix) {
        const childPrefix = Pattern.concat(this.prefix, prefix)
        const childPostfix = Pattern.concat(postfix, this.postfix)

        const childAnswers = [...this.answers, ...answers]
        const childErrors = [...this.errors, ...errors]

        const childAnswerStruct = this.answerStruct.createChildStruct(answerPrefix, answerPostfix)
        const childErrorStruct = this.errorStruct.createChildStruct(errorPrefix, errorPostfix)

        return CallStruct(childPrefix, childPostfix, childAnswers, childErrors, childAnswerStruct, childErrorStruct)
    }

    createChild(core, answers, errors) {
        const pattern = Pattern.concat(this.prefix, core, this.postfix)
        
        const childAnswers = [...this.answers, ...answers]
        const childErrors = [...this.errors, ...errors]

        return Call('', pattern, childAnswers, childErrors)
    }
}

class Packet {
    constructor(name, pattern) {
        this.name = name
        this.pattern = pattern
    }
}

class Call extends Packet {
    constructor(name, request, answers, errors) {
        super(name, request)
        this.answers = answers
        this.errors = errors
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
    constructor(patternString, matchArray) {
        let charArray = patternString.replace(/\s+/g, '').split('')
        let markerDict = {}
        
        this.parameterGroups = new Set()
        for (const match of matchArray) {
            this.parameterGroups.add(match.parameterGroup)

            for (const [idx, marker] of match.markers.entries()) {
                if (!markerDict.hasOwnProperty(marker)) {
                    markerDict[marker] = []
                }
                markerDict[marker].push({
                    parameterGroup: match.parameterGroup,
                    idx: idx,
                })
            }
        }
        
        this.payloadTemplate = charArray.map((char) => {
            let hex = parseInt(char, 16)
            if (isNaN(hex)) {
                return markerDict[char].shift()
            } else {
                return hex
            }
        })
    }

    writePayload = function (parameterDict) {
        let parameterGroupsHexArray = new Map()

        for (const parameterGroup of this.parameterGroups) {
            parameterGroupsHexArray.set(parameterGroup, parameterGroup.encoder(parameterDict))
        }

        let payload = this.payloadTemplate.map(element => {
            if (typeof element === 'number') {
                return element
            } else {
                return parameterGroupsHexArray.get(element.parameterGroup)[element.idx]
            }
        })

        return payload
    } 
    
    readPayload = function (payload) {
        if (payload.length !== this.payloadTemplate.length) { throw Error('Pattern has not the same length as the payload')}

        let parameterGroupsHexArray = new Map()
        
        for (const parameterGroup of this.parameterGroups) {
            parameterGroupsHexArray.set(parameterGroup, [])
        }
        
        for (const [idx, element] of this.payloadTemplate.entries()) {
            if (typeof element === 'number') {
                if (payload[idx] !== element) {
                    throw Error('Payload does not match the template')
                }
            } else {
                parameterGroupsHexArray.get(element.parameterGroup)[element.idx] = payload[idx]
            }
        }
        
        let parameterDict = {}
        for (const [parameterGroup, hexArray] of parameterGroupsHexArray) {
            parameterDict = {...parameterDict, ...parameterGroup.decoder(hexArray)}
        }
        
        return parameterDict
    }

    static concat (...patternArray) { // should handle 'undefined' and n>=0 arguments
        let newPattern = new Pattern('', [])
        
        for (const pattern of patternArray) {
            newPattern.payloadTemplate.push(...pattern.payloadTemplate)
            for (const parameterGroup of pattern.parameterGroups)
                newPattern.parameterGroups.add(parameterGroup)
        }
        
        return newPattern
    }
}

module.exports = {
    Parameter: Parameter,
    Range: Range,
    List: List,
    HexLiteral: HexLiteral,
    IPv4: IPv4,
    AsciiString: AsciiString,
    ParameterGroup: ParameterGroup,
    Pattern: Pattern,
    Match: Match
}