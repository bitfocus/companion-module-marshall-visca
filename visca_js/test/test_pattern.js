const { Match, List, Range, ParameterGroup, Pattern } = require('../lib/requestClasses.js')

const addressParameter = new Range('Address', 1, 7)
const senderAddress = ParameterGroup.fromParameter(addressParameter, { 
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})

var p = new Pattern('8x 10 42', [new Match('x', senderAddress)])

console.log(p.writePayload({'Address': 2}))
console.log(p.readPayload([ 8, 10, 1, 0, 4, 2 ]))

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

const resolution = ParameterGroup.fromParameterClass(List, { name: 'Resolution', itemArray: resolutionArray })

var p2 = new Pattern('8x x0 42', [new Match('xx', resolution)])

console.log(p2.writePayload({'Resolution': 'QFHD 4K(3840 x 2160) - 29.97p'}))
console.log(p2.readPayload([ 8, 0, 0xF, 0, 4, 2 ]))

var s = Pattern.concat(p, p2)

console.log(s.writePayload({'Address': 2, 'Resolution': 'QFHD 4K(3840 x 2160) - 29.97p'}))
console.log(s.readPayload([ 8, 10, 1, 0, 4, 2, 8, 0, 0xF, 0, 4, 2 ]))
