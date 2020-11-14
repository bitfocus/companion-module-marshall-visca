const { Parameter, Range, List, HexLiteral, IPv4, AsciiString, ParameterGroup } = require('../lib/requestClasses')
const utils = require('../lib/utils')

const nSockets = 2

const irisPositionArray = [
    { name: 'Close', value: 0x0F },
    { name: 'F1.6',  value: 0x0E },
    { name: 'F2',    value: 0x0D },
    { name: 'F2.2',  value: 0x0C },
    { name: 'F2.7',  value: 0x0B },
    { name: 'F3.2',  value: 0x0A },
    { name: 'F3.8',  value: 0x09 },
    { name: 'F4.5',  value: 0x08 },
    { name: 'F5.4',  value: 0x07 },
    { name: 'F6.3',  value: 0x06 },
    { name: 'F7.8',  value: 0x05 },
    { name: 'F9',    value: 0x04 },
    { name: 'F11',   value: 0x03 },
    { name: 'F13',   value: 0x02 },
    { name: 'F16',   value: 0x01 },
    { name: 'F18',   value: 0x00 }   
]

const resolutionArray = [
    { name: 'QFHD 4K(3840 x 2160) - 29.97p',   value: 0x05 },
    { name: 'QFHD 4K(3840 x 2160) - 25p',      value: 0x06 },
    { name: 'FHD 1080P(1920 x 1080) - 59.94p', value: 0x08 },
    { name: 'FHD 1080P(1920 x 1080) - 50p',    value: 0x09 },
    { name: 'FHD 1080P(1920 x 1080) - 29.97p', value: 0x0B },
    { name: 'FHD 1080P(1920 x 1080) - 25p',    value: 0x0C },
    { name: 'HD 720P(1280 x 720) - 59.94p',    value: 0x0E },
    { name: 'HD 720P(1280 x 720) - 50p',       value: 0x0F },
    { name: 'HD 720P(1280 x 720) - 29.97p',    value: 0x11 },
    { name: 'HD 720P(1280 x 720) - 25p',       value: 0x12 }
]

const irisPosition = ParameterGroup.fromParameterClass(List, { name: 'Iris Position', itemArray: irisPositionArray })
const resolution = ParameterGroup.fromParameterClass(List, { name: 'Resolution', itemArray: resolutionArray })
const zoomAndFocusSpeed = ParameterGroup.fromParameterClass(Range, { name:'Speed', min: 0, max: 7, comment: '0 (Low) to 7 (High)' })
const zoomPosition = ParameterGroup.fromParameterClass(Range, { name:'Zoom Position', min: 0x0000, max: 0x4000, comment: `${0x0000} (Wide end) to ${0x4000} (Tele end)` })
const focusPosition = ParameterGroup.fromParameterClass(Range, { name:'Focus Position', min: 0x0000, max: 0x047A, comment: `${0x0000} (Wide end) to ${0x4000} (Tele end)`, nHex: 4 })
const addressParameter = new Range('Address', 1, 7)
const senderAddress = ParameterGroup.fromParameter(addressParameter, { 
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})
const receiverAddress = ParameterGroup.fromParameter(addressParameter)
const socket = ParameterGroup.fromParameterClass(Range, { name:'Socket', min: 1, max: nSockets })
const vendorID = ParameterGroup.fromParameterClass(HexLiteral, { name: 'Vendor ID', nHex: 4 })
const modelID = ParameterGroup.fromParameterClass(HexLiteral, { name: 'Model ID', nHex: 4 })
const romRevision = ParameterGroup.fromParameterClass(HexLiteral, { name: 'Rom revision', nHex: 4 })
const maximumSocket = ParameterGroup.fromParameterClass(Range, { name: 'Maximum Socket', min: 0x01, max: 0xFF })
const camFWVersionType = ParameterGroup.fromParameterClass(AsciiString, { name: 'Firmware Version Type', nCharacters: 3 })
const camFWVersionBoot = ParameterGroup.fromParameterClass(AsciiString, { name: 'Firmware Version - Boot', nCharacters: 4 })
const ipAddressIPv4 = ParameterGroup.fromParameterClass(IPv4, { name: 'IP Address v4' })
const memoryNumber = ParameterGroup.fromParameterClass(Range, { name: 'Memory Number', min: 0, max: 255, 
    nHex: 3,
    encoder: parameterDict => {
        let blockHexArray = utils.uintToHexArray(Math.floor(parameterDict['Memory Number'] / 128), 1)
        let numberHexArray = utils.uintToHexArray(parameterDict['Memory Number'] % 128, 2)
        let hexArray = [...blockHexArray, ...numberHexArray]
        return hexArray
    },
    decoder: hexArray => {
        let block = utils.hexArrayToUint(hexArray.slice(0, 1))
        let number = utils.hexArrayToUint(hexArray.slice(1))
        let value = block * 128 + number
        return { 'Memory Number': value }
    }
})

const compareArrays = (array1, array2) => {
    if (array1.length !== array2.length) { return false }
    for (const idx in array1) { if (array1[idx] !== array2[idx]) { return false }}
    return true
}
const compareDicts = (dict1, dict2) => compareArrays(Object.keys(dict1), Object.keys(dict2)) && compareArrays(Object.values(dict1), Object.values(dict2))

const testDecodeEncode = (parameterGroup, valueArray) => compareArrays(parameterGroup.encoder(parameterGroup.decoder(valueArray)), valueArray)
const logDecodeEncode = (parameterGroup, valueArray) => console.log(`${parameterGroup.parameterArray[0].name} with ${valueArray}: ${testDecodeEncode(parameterGroup, valueArray)}`)

const testEncodeDecode = (parameterGroup, parameterDict) => compareDicts(parameterGroup.decoder(parameterGroup.encoder(parameterDict)), parameterDict)
const logEncodeDecode = (parameterGroup, parameterDict) => console.log(`${parameterGroup.parameterArray[0].name} with ${JSON.stringify(parameterDict)}: ${testEncodeDecode(parameterGroup, parameterDict)}`)

const testCoder = (parameterGroup, parameterDict, valueArray) => {
    logDecodeEncode(parameterGroup, valueArray)
    logEncodeDecode(parameterGroup, parameterDict)
    console.log(`${parameterGroup.parameterArray[0].name} match encode: ${compareArrays(parameterGroup.encoder(parameterDict), valueArray)}`)
    console.log(`${parameterGroup.parameterArray[0].name} match decode: ${compareDicts(parameterGroup.decoder(valueArray), parameterDict)}`)
}

testCoder(irisPosition, { 'Iris Position': 'Close' }, [ 0xF ])
testCoder(resolution, { 'Resolution': 'HD 720P(1280 x 720) - 29.97p' }, [ 0x1, 0x1 ])
testCoder(zoomAndFocusSpeed, { 'Speed': 4 }, [ 0x4 ])
testCoder(zoomPosition, { 'Zoom Position': 0x3400 }, [ 0x3, 0x4, 0x0, 0x0 ])
testCoder(focusPosition, { 'Focus Position': 0x0400 }, [ 0x0, 0x4, 0x0, 0x0 ])
testCoder(senderAddress, { 'Address': 1 }, [ 0x9 ])
testCoder(receiverAddress, { 'Address': 3 }, [ 0x3 ])
testCoder(socket, { 'Socket': 2 }, [ 0x2 ])
testCoder(vendorID, { 'Vendor ID': '0001' }, [ 0x0, 0x0, 0x0, 0x1 ])
testCoder(modelID, { 'Model ID': '0513' }, [ 0x0, 0x5, 0x1, 0x3 ])
testCoder(romRevision, { 'Rom revision': '0104' }, [ 0x0, 0x1, 0x0, 0x4 ])
testCoder(maximumSocket, { 'Maximum Socket': 2 }, [ 0x0, 0x2 ])
testCoder(camFWVersionType, { 'Firmware Version Type': 'VBO' }, [ 0x5, 0x6, 0x4, 0x2, 0x4, 0xF ])
testCoder(camFWVersionBoot, { 'Firmware Version - Boot': 'ABCD' }, [ 0x4, 0x1, 0x4, 0x2, 0x4, 0x3, 0x4, 0x4 ])
testCoder(ipAddressIPv4, { 'IP Address v4': '192.168.102.33' }, [ 0xC, 0x0, 0xA, 0x8, 0x6, 0x6, 0x2, 0x1 ])
testCoder(memoryNumber, { 'Memory Number': 139 }, [ 0x1, 0x0, 0xB ])