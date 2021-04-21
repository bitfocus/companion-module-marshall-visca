const { Range, List, HexLiteral, IPv4, AsciiString, ParameterGroup } = require('../lib/requestClasses')
const utils = require('../lib/utils')

const nSockets = 2

const irisPositionArray = {
    'Close': 0x0F,
    'F1.6':  0x0E,
    'F2':    0x0D,
    'F2.2':  0x0C,
    'F2.7':  0x0B,
    'F3.2':  0x0A,
    'F3.8':  0x09,
    'F4.5':  0x08,
    'F5.4':  0x07,
    'F6.3':  0x06,
    'F7.8':  0x05,
    'F9':    0x04,
    'F11':   0x03,
    'F13':   0x02,
    'F16':   0x01,
    'F18':   0x00   
}

const resolutionArray = {
    'QFHD 4K(3840 x 2160) - 29.97p':   0x05,
    'QFHD 4K(3840 x 2160) - 25p':      0x06,
    'FHD 1080P(1920 x 1080) - 59.94p': 0x08,
    'FHD 1080P(1920 x 1080) - 50p':    0x09,
    'FHD 1080P(1920 x 1080) - 29.97p': 0x0B,
    'FHD 1080P(1920 x 1080) - 25p':    0x0C,
    'HD 720P(1280 x 720) - 59.94p':    0x0E,
    'HD 720P(1280 x 720) - 50p':       0x0F,
    'HD 720P(1280 x 720) - 29.97p':    0x11,
    'HD 720P(1280 x 720) - 25p':       0x12
}

const powerModeArray = {
    'On':            0x02,
    'Off (Standby)': 0x03
}

const powerMode = new List('Power Mode', Object.keys(powerModeArray)).createParameterGroup(powerModeArray, 2)
const irisPosition = new List('Iris Position', Object.keys(irisPositionArray)).createParameterGroup(irisPositionArray)
const resolution = new List('Resolution', Object.keys(resolutionArray)).createParameterGroup(resolutionArray)
const zoomAndFocusSpeed = new Range('Speed', 0, 7, '0 (Low) to 7 (High)').createParameterGroup()
const zoomPosition = new Range('Zoom Position', 0x0000, 0x4000, `${0x0000} (Wide end) to ${0x4000} (Tele end)`).createParameterGroup()
const focusPosition = new Range('Focus Position', 0x0000, 0x047A, `${0x0000} (Wide end) to ${0x4000} (Tele end)`).createParameterGroup(4)
const addressParameter = new Range('Address', 1, 7)
const senderAddress = new ParameterGroup(addressParameter, {
    nHex: 1,
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})
const receiverAddress = addressParameter.createParameterGroup()
const socket = new Range('Socket', 1, nSockets).createParameterGroup()
const vendorID = new HexLiteral('Vendor ID', 4).createParameterGroup()
const modelID = new HexLiteral('Model ID', 4).createParameterGroup()
const romRevision = new HexLiteral('Rom revision', 4).createParameterGroup()
const maximumSocket = new Range('Maximum Socket', 0x01, 0xFF).createParameterGroup()
const camFWVersionType = new AsciiString('Firmware Version Type', 3).createParameterGroup()
const camFWVersionBoot = new AsciiString('Firmware Version - Boot', 4).createParameterGroup()
const ipAddressIPv4 = new IPv4('IP Address v4').createParameterGroup()
const memoryNumber = new ParameterGroup(new Range('Memory Number', 0, 255), {
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

testCoder(powerMode, { 'Power Mode': 'Off (Standby)' }, [ 0x0, 0x3 ])
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