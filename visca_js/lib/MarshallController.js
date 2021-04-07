const { CallStruct, PacketStruct, Packet, Range, List, ParameterGroup, Pattern, Match } = require('../lib/requestClasses')
const ViscaController = require('./ViscaController')

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

const powerModeArray = [
    { name: 'On',            value: 0x02 },
    { name: 'Off (Standby)', value: 0x03 }
]

const powerMode = ParameterGroup.fromParameterClass(List, { name: 'Power Mode', itemArray: powerModeArray, nHex: 2 })
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

const replyStruct = new PacketStruct(
    new Pattern('X0', [ new Match('X', senderAddress) ]),
    new Pattern('FF')
)

const replies = [
    replyStruct.createChild('Syntax Error', new Pattern('60 02'), undefined, Packet.types.ERROR),
    replyStruct.createChild('Command buffer full', new Pattern('60 03'), undefined, Packet.types.ERROR),
    replyStruct.createChild('Command cancelled', new Pattern('6Y 04', new Match('Y', socket)), undefined, Packet.types.ERROR),
    replyStruct.createChild('No socket (to be cancelled)', new Pattern('6Y 05', new Match('Y', socket)), undefined, Packet.types.ERROR),
]

const requestSet = new CallStruct(
    new Pattern('8x', [ new Match('x', receiverAddress) ]),
    new Pattern('FF'),
    undefined,
    replies,
    replyStruct
)

const command = requestSet.createChildStruct(
    new Pattern('01'),
    undefined,
    Packet.types.COMMAND,
    [
        requestSet.replyStruct.createChild('Ack', new Pattern('4Y', new Match('Y', socket)), undefined, Packet.types.ACK),
        requestSet.replyStruct.createChild('Completion', new Pattern('5Y', new Match('Y', socket)), undefined, Packet.types.COMPLETION),
        requestSet.replyStruct.createChild('Command not executable', new Pattern('6Y 41', new Match('Y', socket)), undefined, Packet.types.ERROR) 
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
class MarshallController extends ViscaController {

    constructor(connection, address=1) {
        super(connection, address, nSockets)

        this._requestSet = {
            packets: {
                'command': {
                    packets: {
                        'CAM_Power': power,
                        'CAM_Focus': {
                            packets: {
                                'Stop': focus_stop,
                                'Far (Standard)': focus_farStandard,
                                'Near (Standard)': focus_nearStandard,
                                'Far Step': focus_farStep,
                                'Near Step': focus_nearStep,
                                'Far (Variable)': focus_farVariable,
                                'Near (Variable)': focus_nearVariable,
                                'Direct': focus_direct
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = MarshallController