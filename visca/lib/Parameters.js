/* eslint-disable no-empty-pattern */
const utils = require('./utils')

class Parameter {
    constructor(name, comment) {
        this.name = name
        this.comment = comment
    }

    validate() {
        throw Error('Function not implemented')
    }

    createParameterGroup() {
        const nHex = 1
        const encoder = () => Array(nHex)
        const decoder = () => ({ [this.name]: undefined })

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class Range extends Parameter {
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

    createParameterGroup(nHex) {
        // nHex ??= this.max.toString(16).length // Node 15.0
        if (nHex === undefined) {
            nHex = this.max.toString(16).length
        }

        const encoder = parameterDict => {
            const value = parameterDict[this.name]
            const hexArray = utils.uintToHexArray(value, nHex)
            return hexArray
        }

        const decoder = hexArray => {
            const value = utils.hexArrayToUint(hexArray)
            const parameterDict = { [this.name]: value }
            return parameterDict
        }

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class List extends Parameter {
    constructor(name, itemNameArray, comment) {
        super(name, comment)

        this.itemNameArray = itemNameArray
    }

    validate(value) {
        return this.itemNameArray.includes(value)
    }

    createParameterGroup(itemDict, nHex) {
        // nHex ??= Math.max(Object.values(itemDict)).toString(16).length // Node 15.0
        if (nHex === undefined) {
            nHex = Math.max(...Object.values(itemDict)).toString(16).length
        }

        const encoderMap = new Map()
        const decoderMap = new Map()

        this.itemNameArray.forEach(itemName => {
            const itemValue = itemDict[itemName]
            if (!Number.isInteger(itemValue)) {
                throw new Error(`No valid value (${itemValue}) for item name ${itemName}`)
            }

            encoderMap.set(itemName, itemValue)
            decoderMap.set(itemValue, itemName)
        })

        const encoder = parameterDict => {
            const itemName = parameterDict[this.name]
            const itemValue = encoderMap.get(itemName)
            const hexArray = utils.uintToHexArray(itemValue, nHex)
            return hexArray
        }

        const decoder = hexArray => {
            const itemValue = utils.hexArrayToUint(hexArray)
            const itemName = decoderMap.get(itemValue)
            const parameterDict = { [this.name]: itemName }
            return parameterDict
        }

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class HexLiteral extends Parameter {
    constructor(name, nHex, comment) {
        super(name, comment)
    
        this.nHex = nHex
    }

    validate(value) {
        const hexArray = utils.hexStringToHexArray(value)
        const byteArray = utils.hexArrayToByteArray(hexArray)
        return hexArray.length === this.nHex && !hexArray.includes(NaN) && !byteArray.includes(0xFF)
    }
    
    createParameterGroup(spacer='') {
        const nHex = this.nHex
        
        const encoder = parameterDict => {
            const hexString = parameterDict[this.name]
            const hexArray = utils.hexStringToHexArray(hexString).slice(0, nHex)
            return hexArray
        }

        const decoder = hexArray => {
            const hexString = utils.hexArrayToHexString(hexArray, spacer)
            const parameterDict = { [this.name]: hexString}
            return parameterDict
        }

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class IPv4 extends Parameter {
    constructor(name, comment) {
        super(name, comment)
    }

    validate(value) {
        const oktetStringArray = value.split('.')
        const oktetArray = oktetStringArray.map(oktetString => Number(oktetString))
        return oktetArray.length === 4 && oktetArray.every(oktet => oktet >= 0x00 && oktet <= 0xFF)
    }
    
    createParameterGroup() {
        const nHex = 4
        
        const encoder = parameterDict => {
            const ipv4String = parameterDict[this.name]
            const oktetStringArray = ipv4String.split('.')
            const oktetArray = oktetStringArray.map(oktetString => Number(oktetString))
            const hexArray = utils.byteArrayToHexArray(oktetArray)
            return hexArray
        }

        const decoder = hexArray => {
            const oktetArray = utils.hexArrayToByteArray(hexArray)
            const oktetStringArray = oktetArray.map(oktet => String(oktet))
            const ipv4String = oktetStringArray.join('.')
            const parameterDict = { [this.name]: ipv4String}
            return parameterDict
        }

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class AsciiString extends Parameter {
    constructor(name, nCharacters, comment) {
        super(name, comment)

        this.nCharacters = nCharacters
    }

    validate(value) {
        // eslint-disable-next-line no-control-regex
        return value.length === this.nCharacters && /^[\x00-\x7F]*$/.test(value)
    }
    
    createParameterGroup() {
        const nHex = this.nCharacters
        
        const encoder = parameterDict => {
            const string = parameterDict[this.name]
            const characterArray = string.split('')
            const byteArray = characterArray.map(character => character.charCodeAt(0))
            const hexArray = utils.byteArrayToHexArray(byteArray)
            return hexArray
        }

        const decoder = hexArray => {
            const byteArray = utils.hexArrayToByteArray(hexArray)
            const characterArray = byteArray.map(byte => String.fromCharCode(byte))
            const string = characterArray.join('')
            const parameterDict = { [this.name]: string}
            return parameterDict
        }

        return new ParameterGroup(this, { nHex, encoder, decoder })
    }
}

class ParameterGroup {
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
            const value = parameterDict[parameter.name]
            if (typeof value === 'undefined') { throw Error(`Parameter not found in parameter dict: ${parameter.name}`)}
            if (!parameter.validate(value)) { throw Error(`Parameter for ${parameter.name} invalid: ${value}`)}
        }
    }
}

module.exports = {
    Parameter,
    Range,
    List,
    HexLiteral,
    IPv4,
    AsciiString,
    ParameterGroup
}