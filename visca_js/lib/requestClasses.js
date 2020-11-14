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

class MarkerObject {
    constructor(markers, parameterGroup) {

    }
}

class RequestObject {
    constructor(name, parentObject, options) {
        this.name = name
        this.parentObject = parentObject
        
        this.prefix = options.prefix
        this.postfix = options.postfix
        this.markers = options.markers
        this.reply = options.reply
        this.error = options.error
        this.comment = options.comment
    }
}

class Packet extends RequestObject {
    constructor(name, parentObject, options) {
        if (typeof options === 'object') {
            super(name, parentObject, options)
            this.core = options.pattern
            this.coreOnly = options.coreOnly
        } else {
            super(name, parentObject, {})
            this.core = options
        }


    }


    createPayload(parameterDict) {

    }
}

module.exports = {
    Parameter: Parameter,
    Range: Range,
    List: List,
    HexLiteral: HexLiteral,
    IPv4: IPv4,
    AsciiString: AsciiString,
    ParameterGroup: ParameterGroup
}