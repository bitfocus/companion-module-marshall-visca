const { Match, Pattern } = require('../lib/Packets.js')
const { List, Range, ParameterGroup } = require('../lib/Parameters.js')

const createPayload = (hexPayload) => 
    hexPayload.flatMap((halfByte, idx, hexPayload) => 
        (idx % 2) ? [ 0x10 * hexPayload[idx-1] + hexPayload[idx] ] : []
    )

const addressParameter = new Range('Address', 1, 7)
const senderAddress = new ParameterGroup(addressParameter, {
    nHex: 1,
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})
    
var p = new Pattern('8x 10 42', [new Match('x', senderAddress)])

console.log(p.writePayload({'Address': 2}))
console.log(p.readPayload(createPayload([ 8, 10, 1, 0, 4, 2 ])))

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

const resolution = new List('Resolution', Object.keys(resolutionArray)).newGroup(resolutionArray)

var p2 = new Pattern('8x x0 42', [new Match('xx', resolution)])

console.log(p2.writePayload({'Resolution': 'QFHD 4K(3840 x 2160) - 29.97p'}))
console.log(p2.readPayload(createPayload([ 8, 0, 0xF, 0, 4, 2 ])))

var s = Pattern.concat(p, p2)

console.log(s.writePayload({'Address': 2, 'Resolution': 'QFHD 4K(3840 x 2160) - 29.97p'}))
console.log(s.readPayload(createPayload([ 8, 10, 1, 0, 4, 2, 8, 0, 0xF, 0, 4, 2 ])))
