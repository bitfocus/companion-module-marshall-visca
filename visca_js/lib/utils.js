/**
 * @author Steffen Zeil
 */


/**
 * Converts a array of bytes into a unsinged integer.
 * 
 * Most significant byte first.
 * Inverse method to {@link uintToByteArray}.
 * 
 * @param {Iterable.<number>}  byteArray  Array of integers between 0 and 255.
 * @return {number}                       Return unsigned integer.
 */
exports.byteArrayToUint = function (byteArray) {
    return byteArray.reduce((sum, byte, pos, arr) => sum + byte * 256 ** (arr.length - pos - 1), 0)
}

/**
 * Converts a unsinged integer into a array of bytes.
 * 
 * Most significant byte first.
 * Overflow is discarded.
 * Inverse method to {@link byteArrayToUint}.
 * 
 * @param {number}  integer  Unsigned integer.
 * @param {number}  length   Number of returned bytes. Must be a positiv integer.
 * @return {Uint8Array}      Return array of integers between 0 and 255.
 */
exports.uintToByteArray = function (integer, length) {
    let int_array = Array.from({length: length}, (_, i) => (integer >>> (8 * (length - i - 1))) % 256)
    return new Uint8Array(int_array)
}

/**
 * Converts a array of hexadezimal values (half-byte) into a unsinged integer.
 * 
 * Most significant byte first.
 * Inverse method to {@link uintToHexArray}.
 * 
 * @param {Array.<number>}  hexArray  Array of integers between 0 and 15.
 * @return {number}                   Return unsigned integer.
 */
exports.hexArrayToUint = function (hexArray) {
    return hexArray.reduce((int, hex) => int * 16 + hex, 0)
}

/**
 * Converts a unsinged integer into a array of hexadezimal values (half-byte).
 * 
 * Most significant byte first.
 * Overflow is discarded.
 * Inverse method to {@link hexArrayToUint}.
 * 
 * @param {number}  integer     Unsigned integer.
 * @param {number}  [length=2]  Number of returned hexadezimal values. Must be a positiv integer.
 * @return {Array.<number>}     Return array of integers between 0 and 15.
 */
exports.uintToHexArray = function (integer, length=2) {
    return Array.from({length: length}, (_, i) => (integer >>> (4 * (length - i - 1))) % 16)
}

/**
 * Converts a array of bytes into a array of hexadezimal values (half-byte).
 * 
 * Most significant byte first.
 * 
 * @param {Iterable.<number>}  byteArray  Array of integers between 0 and 255.
 * @return {Array.<number>}               Return array of integers between 0 and 15.
 */
exports.byteArrayToHexArray = function (byteArray) {
    return byteArray.reduce((hexArray, byte) => hexArray.concat(exports.uintToHexArray(byte)), [])
}

/**
 * Converts a array of bytes into a string of hexadezimal digits.
 * 
 * Most significant byte first.
 * Hexadezimal values as [0-9A-F].
 * The spacer is used to seperate the bytes which are represented as a pair of hexadezimal digits.
 * 
 * @param {Array.<number>}  byteArray     Array of integers between 0 and 255.
 * @param {string}          [spacer=' ']  Spacer string between the pairs of hexadezimal values.
 * @return {string}                       Return string containing the hexadezimal values.
 */
exports.byteArrayToHexString = function (byteArray, spacer=' ') {
    let hexArray = exports.byteArrayToHexArray(byteArray)
    return exports.hexArrayToHexString(hexArray, spacer)
}

/**
 * Converts a array of hexadezimal values into a string of hexadezimal digits.
 * 
 * Most significant byte first.
 * Hexadezimal values as [0-9A-F].
 * The spacer is used to seperate the bytes which are represented as a pair of hexadezimal digits.
 * 
 * @param {Array.<number>} hexArray      Array of integers between 0 and 15.
 * @param {string}         [spacer=' ']  Spacer string between the pairs of hexadezimal values.
 * @return {string}                      Return string containing the hexadezimal values.
 */
exports.hexArrayToHexString = function (hexArray, spacer=' ') {
    let hexCharArray = hexArray.map(hex => hex.toString(16).toUpperCase())
    return hexCharArray.join('').match(/../g).join(spacer)
}

/**
 * Get the first key matching the given value in an object
 *  
 * @param {object} object  Object.
 * @param {*} value        Comperable value to search for.
 * @returns {string}       First key with matching value.
 */
exports.getKeyByValue = function (object, value) {
    return Object.keys(object).find(key => object[key] === value)
}

/**
 * The pattern describing the payload of a message.
 * 
 * Beside optional spaces it can contain two types of characters:
 * - Hexadezimal digits [0-9a-fA-F], which match the hexadezimal value at the corresponding position.
 * - Marker letters [g-zG-Z], which are translated to a hexadezimal value using at the corresponding position.
 * @typedef {string} Pattern
 */


/**
 * Creates an dictonary of the markers in the pattern and their corresponding value in the payload.
 * 
 * Each non-hexadezimal char in the pattern, called marker appears as a key in the resulting dictionary.
 * The value of that marker is the value from the payload at the corresponding positon.
 * If a marker appears multiple times in the pattern the corresponding values are read as an array of hexadezimal values.
 * 
 * @example Example usage.
 * // returns { X: 1, p: 10, s: 18 }
 * readPayload('8X 00 1p 2s 3s FF', [ 0x81, 0x00, 0x1A, 0x21, 0x32, 0xFF ])
 * @example Example usage.
 * // throws Error('Pattern is not matching the payload')
 * readPayload('8X 00 FF', [ 0x81, 0x01, 0xFF ])
 * 
 * @throws Will throw an error if the payload is not matching the pattern.
 * 
 * @param {Pattern}            pattern  String describing the pattern that the payload should match.
 * @param {Iterable.<number>}  payload  Array of recieved bytes.
 * @returns {object}           markers  Dictionary of the markers found in the pattern.
 * @returns {number}           markers['x']  Hexadezimal value in the payload at the position of marker 'x'.
 */
exports.readPayload = function (pattern, payload) {
    let patternCharArray = pattern.replace(/\s+/g, '').split('')
    let payloadHexArray = exports.byteArrayToHexArray(payload)
    if (patternCharArray.length !== payloadHexArray.length) { throw Error('Pattern has not the same length as the payload')}

    let markers = {}
    for (const idx in patternCharArray) {
        let char = patternCharArray[idx]
        let patternHex = parseInt(char, 16)
        let payloadHex = payloadHexArray[idx]
        if (isNaN(patternHex)) {
            if (markers.hasOwnProperty(char)) {
                markers[char] = 16 * markers[char] + payloadHex
            } else {
                markers[char] = payloadHex
            }
        } else {
            if (patternHex != payloadHex) { throw Error('Pattern is not matching the payload')}
        }
    }
    return markers
}

exports.identifyPacket = function (reply, payload, validatiorArguments) {
    let packets = reply.packets || {}
    if (reply.hasOwnProperty('pattern')) {
        packets[''] = reply
    }
    for (var [packetName, packet] of Object.entries(packets)) {
        try {
            var markersDict = exports.readPayload(packet.pattern, payload)
        } catch (error) { continue }
        let parameters = exports.decodeMarkers(packet.markers, markersDict, validatiorArguments)
        return [packetName || '', parameters]
    }
    return [undefined, undefined]
}

/**
 * Creates a payload using a pattern and a markers dictionary holding the values.
 * 
 * Each non-hexadezimal char in the pattern, called marker needs to be a key in the markers dictionary.
 * The value of that marker is used as value in the payload at the corresponding positon.
 * If a marker appears multiple times in the pattern the corresponding values are written as an array of hexadezimal values.
 * 
 * @example Example usage.
 * // returns [ 129, 0, 26, 33, 50, 255 ]
 * // equivalent to [ 0x81, 0x00, 0x1A, 0x21, 0x32, 0xFF ]
 * writePayload('8X 00 1p 2s 3s FF', { X: 1, p: 10, s: 18 })
 * 
 * @throws Will throw an error if the pattern has an odd number of digits.
 * 
 * @param {Pattern}         pattern       String describing the pattern that the payload should match.
 * @param {object}          markers       Dictionary of the markers found in the pattern.
 * @param {number}          markers['x']  Hexadezimal value in the payload at the position of marker 'x'.
 * @param {Array.<number>}  payload       Array of recieved bytes.
 */
exports.writePayload = function (pattern, markers) {
    pattern = pattern.replace(/\s+/g, '').split('') // Filter spaces and create char array
    if (pattern.length % 2 != 0) { throw Error('Pattern must have a even number of digits') }
    let payload = Array(pattern.length / 2)
    for (let idx = payload.length - 1; idx >= 0; idx--) { // Go backwards. In case the same parameter char appears multiple times the 4 LSBs are in the position where this char occurs last
        let chars = pattern.slice(idx * 2, (idx + 1) * 2)
        let patternOctet = chars.reverse().map((char) => {
            let octet = parseInt(char, 16)
            if (isNaN(octet)) {
                octet = markers[char] & (16 - 1)
                markers[char] >>= 4
            }
            return octet
        }).reverse()
        payload[idx] = patternOctet[0] * 16 + patternOctet[1]
    }
    return payload
}

exports.checkParameter = function (parameter, value) {
    switch (parameter.type) {
        case 'range':
            if (value < parameter.min || value > parameter.max) {
                throw Error(`Parameter value ${value} must be in range [${parameter.min}, ${parameter.max}]`)
            }
            break
        case 'hex':
            // TODO
            break
        case 'list':{
            if (!parameter.list.hasOwnProperty(value)) {
                throw Error(`Parameter value ${value} not found in list`)
            }
            break
        }
        default:
            throw Error('Unknown parameter type')
    }
}

exports.encodeParameters = function (markersSets, parameters) {
    let markersDict = {}
    for (let [markers, markersObject] of Object.entries(markersSets)) {
        for (let parameterName in markersObject.parameters) {
            exports.checkParameter(markersObject.parameters[parameterName], parameters[parameterName])
        }
        let markerValues = markersObject.encoder(parameters)
        for (let ind in markers) {
            markersDict[markers[ind]] = markerValues[ind]
        }
    }
    return markersDict
}

exports.decodeMarkers = function (markersSets, markersDict, validatorArguments={}) {
    let parameters = {}
    for (let [markers, markersObject] of Object.entries(markersSets)) {
        let markersValues = []
        for (let marker of markers) {
            markersValues.push(markersDict[marker])
        }
        let currentParameters = markersObject.decoder(markersValues)
        for (let parameterName in markersObject.parameters) {
            exports.checkParameter(markersObject.parameters[parameterName], currentParameters[parameterName])
        }
        if (markersObject.hasOwnProperty('validator')) {
            if (markersObject.validatorArguments.every(name => validatorArguments.hasOwnProperty(name))) {
                if (!markersObject.validator(currentParameters, validatorArguments)) {
                    throw Error(`Invalid parameters based on ${JSON.stringify(validatorArguments)}`)
                }
            }
        }
        parameters = {...parameters, ...currentParameters}
    }
    return parameters
}

exports.decompressRequestSet = function (packet, parentPacket={}, packetName='root') {
    concatSpaced = strings => strings.filter(Boolean).join(' ')

    let packetCopy
    if (typeof packet !== 'object') {
        packetCopy = { core: String(packet) }
    } else {
        packetCopy = Object.assign({}, packet)
    }
    packetCopy.name = (parentPacket.name || []).concat(packetName)

    for (const reply_type of ['answer', 'error']) {
        if (!packet.hasOwnProperty(reply_type) && !parentPacket.hasOwnProperty(reply_type)) {
            continue // This is also the case if a answer or error packet gets decompressed
        }

        let childReplyPacket = packet[reply_type] || {}
        let parentReplyPacket = parentPacket[reply_type] || {}
        packetCopy[reply_type] = exports.decompressRequestSet(childReplyPacket, parentReplyPacket, packetName)
        packetCopy[reply_type].packets = Object.assign({}, parentReplyPacket.packets, childReplyPacket.packets)
    }
    
    // Property 'pattern' is used if 'core' and 'pattern' are given
    if (packetCopy.hasOwnProperty('pattern')) {
        packetCopy.pattern = packet.pattern
        packetCopy.markers = Object.assign({}, packet.markers)
    } else {
        packetCopy.rootPrefix = packetCopy.rootPrefix || concatSpaced([parentPacket.rootPrefix, packet.prefix])
        packetCopy.rootPostfix = packetCopy.rootPostfix || concatSpaced([parentPacket.rootPostfix, packet.postfix])
        packetCopy.markers = Object.assign({}, parentPacket.markers, packet.markers)
        if (packetCopy.hasOwnProperty('core')) {
            packetCopy.pattern = concatSpaced([packetCopy.rootPrefix, packetCopy.core, packetCopy.rootPostfix])
        } else if (packet.hasOwnProperty('packets')) {
            // Recursive algorithm
            for (let [name, childPacket] of Object.entries(packet.packets)) {
                packetCopy.packets[name] = exports.decompressRequestSet(childPacket, packetCopy, name)
            }
        }
    } 

    return packetCopy
}