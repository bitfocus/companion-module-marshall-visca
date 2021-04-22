const { CommandFamily, PacketFamily, Packet, Pattern, Match } = require('./Packets')
const { Range, List, ParameterGroup } = require('./Parameters')
const { Udp } = require('./Connection')
const ViscaOverIpSocket = require('./ViscaSocket')
const ViscaCamera = require('./ViscaCamera')
const CommandSet = require('./CommandSet')

const nSockets = 2

// Lookup tables

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

const powerModeArray = {
    'On':            0x02,
    'Off (Standby)': 0x03
}

const defaultOnOffArray = {
    'On':            0x02,
    'Off (Standby)': 0x03
}

const focusModeArray = {
    'Auto Focus':   0x02,
    'Manual Focus': 0x03
}

const curveTrackingArray = {
    'Curve tracking': 0x02,
    'Zoom tracking':  0x03
}

const autofocusSensitivtyArray = {
    'High':   0x01,
    'Middle': 0x02,
    'Low':    0x03
}

const autofocusFrameArray = {
    'Auto':       0x01,
    'Full Frame': 0x02,
    'Center':     0x03
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

const hdmiOutputRangeArray = {
    '16~235': 0x01,
    '1~254':  0x02
}

const whiteBalanceModeArray = {
    'Auto':         0x00,
    'Indoor':       0x01,
    'Outdoor':      0x02,
    'One Push':     0x03,
    'Auto Tracing': 0x04,
    'Manual':       0x05,
    'Sodium Lamp':  0x0C
}

// Parameters
const addressParameter = new Range('Address', 1, 7)
const senderAddress = new ParameterGroup(addressParameter, {
    nHex: 1,
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})
const receiverAddress = addressParameter.createParameterGroup()
const socket = new Range('Socket', 1, nSockets).createParameterGroup()

const powerMode = new List('Power Mode', Object.keys(powerModeArray)).createParameterGroup(powerModeArray, 2)
const zoomAndFocusSpeed = new Range('Speed', 0, 7, '0 (Low) to 7 (High)').createParameterGroup()
const zoomPosition = new Range('Zoom Position', 0x0000, 0x4000, `${0x0000} (Wide end) to ${0x4000} (Tele end)`).createParameterGroup()
const zoomMemoryMode = new List('Focus Mode', Object.keys(defaultOnOffArray)).createParameterGroup(defaultOnOffArray, 2)
const focusPosition = new Range('Focus Position', 0x0000, 0x047A, `${0x0000} (Wide end) to ${0x4000} (Tele end)`).createParameterGroup(4)
const focusMode = new List('Focus Mode', Object.keys(focusModeArray)).createParameterGroup(focusModeArray, 2)
const curveTracking = new List('Curve Tracking', Object.keys(curveTrackingArray)).createParameterGroup(curveTrackingArray, 2)
const autofocusSensitivty = new List('Autofocus Sensitivity', Object.keys(autofocusSensitivtyArray)).createParameterGroup(autofocusSensitivtyArray, 2)
const autofocusFrame = new List('Autofocus Frame', Object.keys(autofocusFrameArray)).createParameterGroup(autofocusFrameArray, 2)
const resolution = new List('Resolution', Object.keys(resolutionArray)).createParameterGroup(resolutionArray)
const hdmiOutputRange = new List('HDMI Output Range', Object.keys(hdmiOutputRangeArray)).createParameterGroup(hdmiOutputRangeArray, 2)
const whiteBalanceMode = new List('White Balance Mode', Object.keys(whiteBalanceModeArray)).createParameterGroup(whiteBalanceModeArray, 2)
const whiteBalanceRedGain = new Range('White Balance Red Gain', 0x00, 0x80, `${0x00} to ${0x80}`).createParameterGroup(2)
const whiteBalanceBlueGain = new Range('White Balance Blue Gain', 0x00, 0x80, `${0x00} to ${0x80}`).createParameterGroup(2)

const irisPosition = new List('Iris Position', Object.keys(irisPositionArray)).createParameterGroup(irisPositionArray)

// Packets definitions
const commandArray = []

const replyFamily = new PacketFamily(undefined,
    new Pattern('X0', [ new Match('X', senderAddress) ]),
    new Pattern('FF')
)

const replies = [
    replyFamily.createChild('Syntax Error', new Pattern('60 02'), undefined, Packet.TYPES.ERROR),
    replyFamily.createChild('Syntax Error (unspecified)', new Pattern('6Y 02', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
    replyFamily.createChild('Command buffer full', new Pattern('60 03'), undefined, Packet.TYPES.ERROR),
    replyFamily.createChild('Command cancelled', new Pattern('6Y 04', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
    replyFamily.createChild('No socket (to be cancelled)', new Pattern('6Y 05', new Match('Y', socket)), undefined, Packet.TYPES.ERROR),
]

const commands = new CommandFamily(undefined,
    new Pattern('8x', [ new Match('x', receiverAddress) ]),
    new Pattern('FF'),
    undefined,
    replies,
    replyFamily
)

const tasks = commands.createChildFamily(undefined,
    new Pattern('01'),
    undefined,
    Packet.TYPES.TASK,
    [
        commands.replyFamily.createChild('Ack', new Pattern('4Y', new Match('Y', socket)), undefined, Packet.TYPES.ACK),
        commands.replyFamily.createChild('Completion', new Pattern('5Y', new Match('Y', socket)), undefined, Packet.TYPES.COMPLETION),
        commands.replyFamily.createChild('Command not executable', new Pattern('6Y 41', new Match('Y', socket)), undefined, Packet.TYPES.ERROR) 
    ]
)

commandArray.push(
    tasks.createChild('Power', Pattern.concat(new Pattern('04 00'), Pattern.fromParameterGroup(powerMode)))
)

const zoom = tasks.createChildFamily('Zoom', new Pattern('04'))
commandArray.push(...[
    zoom.createChild('Stop', new Pattern('07 00')),
    zoom.createChild('Tele (Standard)', new Pattern('07 02')),
    zoom.createChild('Wide (Standard)', new Pattern('07 03')),
    zoom.createChild('Tele Step', new Pattern('07 04')),
    zoom.createChild('Wide Step', new Pattern('07 05')),
    zoom.createChild('Tele (Variable)', new Pattern('07 2p', new Match('p', zoomAndFocusSpeed))),
    zoom.createChild('Wide (Variable)', new Pattern('07 3p', new Match('p', zoomAndFocusSpeed))),
    zoom.createChild('Direct', new Pattern('47 0p 0q 0r 0s', new Match('pqrs', zoomPosition))),
    zoom.createChild('Direct (Variable Speed)', new Pattern('47 0p 0q 0r 0s 0t', [ new Match('pqrs', zoomPosition), new Match('t', zoomAndFocusSpeed)])),
    zoom.createChild('Memory Mode', Pattern.concat(new Pattern('47 00'), Pattern.fromParameterGroup(zoomMemoryMode)))
])

const focus = tasks.createChildFamily('Focus', new Pattern('04'))
commandArray.push(...[
    focus.createChild('Stop', new Pattern('08 00'), 'Enabled during Manual Focus Mode'),
    focus.createChild('Far (Standard)', new Pattern('08 02'), 'Enabled during Manual Focus Mode'),
    focus.createChild('Near (Standard)', new Pattern('08 03'), 'Enabled during Manual Focus Mode'),
    focus.createChild('Far Step', new Pattern('08 04'), 'Enabled during Manual Focus Mode'),
    focus.createChild('Near Step', new Pattern('08 05'), 'Enabled during Manual Focus Mode'),
    focus.createChild('Far (Variable)', new Pattern('08 2p', new Match('p', zoomAndFocusSpeed)), 'Enabled during Manual Focus Mode'),
    focus.createChild('Near (Variable)', new Pattern('08 3p', new Match('p', zoomAndFocusSpeed)), 'Enabled during Manual Focus Mode'),
    focus.createChild('Direct', new Pattern('48 0p 0q 0r 0s', new Match('pqrs', focusPosition)), 'Enabled during Manual Focus Mode'),
    focus.createChild('Mode', Pattern.concat(new Pattern('38'), Pattern.fromParameterGroup(focusMode))),
    focus.createChild('Mode Toggle', new Pattern('38 10')),
    focus.createChild('One Push Trigger', new Pattern('18 01'), 'Enabled during Manual Focus Mode')
])

commandArray.push(
    tasks.createChild('Curve Tracking', Pattern.concat(new Pattern('04 38 03'), Pattern.fromParameterGroup(curveTracking)))
)

const autofocus = tasks.createChildFamily('Autofocus', new Pattern('04'))
commandArray.push(...[
    autofocus.createChild('Autofocus Sensitivity', Pattern.concat(new Pattern('58'), Pattern.fromParameterGroup(autofocusSensitivty))),
    autofocus.createChild('Autofocus Frame', Pattern.concat(new Pattern('5C'), Pattern.fromParameterGroup(autofocusFrame))),
    autofocus.createChild('Autofocus Frame Toggle', new Pattern('5C 10'))
])

const zoomAndFocus = tasks.createChildFamily('Zoom and Focus', new Pattern('04'))
commandArray.push(
    zoomAndFocus.createChild('Direct', new Pattern('47 0p 0q 0r 0s 0t 0u 0v 0w 0x', [ 
        new Match('pqrs', zoomPosition),
        new Match('tuvw', focusPosition),
        new Match('x', zoomAndFocusSpeed)
    ]))
)

commandArray.push(
    tasks.createChild('Initialize Lens', new Pattern('04 19 01'))
)
commandArray.push(
    tasks.createChild('Resolution', new Pattern('06 35 0p 0q', new Match('pq', resolution)))
)
commandArray.push(
    tasks.createChild('HDMI Output Range', Pattern.concat(new Pattern('06 37'), Pattern.fromParameterGroup(hdmiOutputRange)))
)

const whiteBalance = tasks.createChildFamily('White Balance', new Pattern('04'))
commandArray.push(...[
    whiteBalance.createChild('Mode', Pattern.concat(new Pattern('35'), Pattern.fromParameterGroup(whiteBalanceMode))),
    whiteBalance.createChild('One Push Trigger', new Pattern('10 05'), 'Enabled during One Push White Balance Mode'),
    whiteBalance.createChild('Red Gain Reset', new Pattern('03 00'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Red Gain Up', new Pattern('03 02'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Red Gain Down', new Pattern('03 03'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Red Gain Direct', new Pattern('43 00 00 0p 0q', new Match('pq', whiteBalanceRedGain)), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Blue Gain Reset', new Pattern('04 00'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Blue Gain Up', new Pattern('04 02'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Blue Gain Down', new Pattern('04 03'), 'Enabled during White Balance Manual Mode'),
    whiteBalance.createChild('Blue Gain Direct', new Pattern('44 00 00 0p 0q', new Match('pq', whiteBalanceBlueGain)), 'Enabled during White Balance Manual Mode'),
])

const commandSet = new CommandSet(commandArray)

class MarshallCamera extends ViscaCamera {
    static get COMMANDS() {
        return commandSet
    }

    constructor(ip, address=1) {
        const connection = new Udp(ip)
        const viscaSocket = new ViscaOverIpSocket(connection, address, nSockets)

        super(viscaSocket)
    }
}

module.exports = MarshallCamera