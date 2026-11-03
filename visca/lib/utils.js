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
export function byteArrayToUint(byteArray) {
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
export function uintToByteArray(integer, length) {
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
export function hexArrayToUint(hexArray) {
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
export function uintToHexArray(integer, length=2) {
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
export function byteArrayToHexArray(byteArray) {
    return byteArray.reduce((hexArray, byte) => hexArray.concat(uintToHexArray(byte)), [])
}

export function hexArrayToByteArray(hexArray) {
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
export function byteArrayToHexString(byteArray, spacer=' ') {
    let hexArray = byteArrayToHexArray(byteArray)
    return hexArrayToHexString(hexArray, spacer)
}

export function hexStringToByteArray(hexString) {
    let hexArray = hexStringToHexArray(hexString)
    return hexArrayToByteArray(hexArray)
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
export function hexArrayToHexString(hexArray, spacer=' ') {
    let hexCharArray = hexArray.map(hex => hex.toString(16).toUpperCase())
    return hexCharArray.join('').match(/../g).join(spacer)
}

export function hexStringToHexArray(hexString) {
    let hexCharArray = hexString.replace(/\s+/g, '').split('')
    return hexCharArray.map(hexChar => parseInt(hexChar, 16))
}
