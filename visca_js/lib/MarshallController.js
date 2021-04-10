const { CallStruct, PacketStruct, Packet, Range, List, ParameterGroup, Pattern, Match } = require('./requestClasses')
const { Udp } = require('./Connection')
const ViscaOverIpSocket = require('./ViscaSocket')
const ViscaCamera = require('./ViscaCamera')

const nSockets = 2

const powerModeArray = [
    { name: 'On',            value: 0x02 },
    { name: 'Off (Standby)', value: 0x03 }
]

const powerMode = ParameterGroup.fromParameterClass(List, { name: 'Power Mode', itemArray: powerModeArray, nHex: 2 })
const zoomAndFocusSpeed = ParameterGroup.fromParameterClass(Range, { name:'Speed', min: 0, max: 7, comment: '0 (Low) to 7 (High)' })
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
    replyStruct.createChild('Syntax Error', new Pattern('60 02'), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('Command buffer full', new Pattern('60 03'), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('Command cancelled', new Pattern('6Y 04', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
    replyStruct.createChild('No socket (to be cancelled)', new Pattern('6Y 05', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
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
    Packet.TYPES.COMMAND,
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

class MarshallCamera extends ViscaCamera {

    constructor(ip, address=1) {
        let connection = new Udp(ip)
        let viscaSocket = new ViscaOverIpSocket(connection, address, nSockets)

        super(viscaSocket)

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

module.exports = MarshallCamera