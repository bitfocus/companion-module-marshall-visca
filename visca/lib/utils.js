/**
 * @author Steffen Zeile
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
    let int_array = Array.from({ length: length }, (_, ind) => (integer >>> (8 * (length - ind - 1))) % 256)
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

exports.hexArrayToByteArray = function (hexArray) {
    if (hexArray.length % 2 !== 0) {
        hexArray = [0, ...hexArray] // Do not modify the array of the caller
    }
    return Array.from({ length: hexArray.length / 2 }, (_, ind) => 16 * hexArray[2 * ind] + hexArray[2 * ind + 1])
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

exports.hexStringToByteArray = function (hexString) {
    let hexArray = exports.hexStringToHexArray(hexString)
    return exports.hexArrayToByteArray(hexArray)
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

exports.hexStringToHexArray = function (hexString) {
    let hexCharArray = hexString.replace(/\s+/g, '').split('')
    return hexCharArray.map(hexChar => parseInt(hexChar, 16))
}
