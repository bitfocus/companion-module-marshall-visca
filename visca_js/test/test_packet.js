/* eslint-disable no-unused-vars */
const { CommandStruct, PacketStruct, Packet, Pattern, Match } = require('../lib/Packets')
const { List, Range, ParameterGroup } = require('../lib/Parameters.js')

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


const replyStruct = new PacketStruct(
    new Pattern('X0', [ new Match('X', senderAddress) ]),
    new Pattern('FF')
)

const replies = [
    replyStruct.createChild('Syntax Error', new Pattern('60 02'), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('Command buffer full', new Pattern('60 03'), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('Command cancelled', new Pattern('6Y 04', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('No socket (to be cancelled)', new Pattern('6Y 05', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
]

const requestSet = new CommandStruct(
    new Pattern('8x', [ new Match('x', receiverAddress) ]),
    new Pattern('FF'),
    undefined,
    replies,
    replyStruct
)

const command = requestSet.createChildStruct(
    new Pattern('01'),
    undefined,
    Packet.TYPES.TASK,
    [
        requestSet.replyStruct.createChild('Ack', new Pattern('4Y', new Match('Y', socket)), undefined, Packet.TYPES.ACK),
        requestSet.replyStruct.createChild('Completion', new Pattern('5Y', new Match('Y', socket)), undefined, Packet.TYPES.COMPLETION),
        requestSet.replyStruct.createChild('Command not executable', new Pattern('6Y 41', new Match('Y', socket)), undefined, Packet.TYPES.ERROR) 
    ]
)

const power = command.createChild('Power', Pattern.concat(new Pattern('04 00'), Pattern.fromParameterGroup(powerMode)))

const focus = command.createChildStruct(new Pattern('04'))
const focus_stop = focus.createChild('Stop', new Pattern('08 00'), 'Enabled during Manual Focus Mode')
const focus_farStandard = focus.createChild('Far (Standard)', new Pattern('08 02'), 'Enabled during Manual Focus Mode')
const focus_nearStandard = focus.createChild('Near (Standard)', new Pattern('08 03'), 'Enabled during Manual Focus Mode')
const focus_farStep = focus.createChild('Far Step', new Pattern('08 04'), 'Enabled during Manual Focus Mode')
const focus_nearStep = focus.createChild('Near Step', new Pattern('08 05'), 'Enabled during Manual Focus Mode')
const focus_farVariable = focus.createChild('Far (Variable)', new Pattern('08 2p', new Match('p', zoomAndFocusSpeed)), 'Enabled during Manual Focus Mode')
const focus_nearVariable = focus.createChild('Near (Variable)', new Pattern('08 3p', new Match('p', zoomAndFocusSpeed)), 'Enabled during Manual Focus Mode')
const focus_direct = focus.createChild('Direct', new Pattern('48 0p 0q 0r 0s', new Match('pqrs', focusPosition)))

console.log(focus_direct.pattern.writePayload({ 'Address': 2, 'Focus Position': 234 }))
console.log(power.pattern.writePayload({ 'Address': 2, 'Power Mode': 'On' }))