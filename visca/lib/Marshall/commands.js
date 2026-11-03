import { CommandFamily, PacketFamily, Packet, Pattern, Match } from '../Packets.js'
import { ParameterGroup } from '../Parameters.js'

import * as lut from './lookupTables.js'
import * as par from './parameters.js'


const senderAddressGroup = new ParameterGroup(par.addressParameter, {
    nHex: 1,
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8  })
})
const receiverAddressGroup = par.addressParameter.newGroup()
const socketGroup = par.socket.newGroup()

const powerModeGroup            = par.powerMode.newGroup(lut.powerModeArray, 2)
const zoomAndFocusSpeedGroup    = par.zoomAndFocusSpeed.newGroup()
const zoomPositionGroup         = par.zoomPosition.newGroup()
const zoomMemoryModeGroup       = par.zoomMemoryMode.newGroup(lut.defaultOnOffArray, 2)
const focusPositionGroup        = par.focusPosition.newGroup(4)
const focusModeGroup            = par.focusMode.newGroup(lut.focusModeArray, 2)
const curveTrackingGroup        = par.curveTracking.newGroup(lut.curveTrackingArray, 2)
const autofocusSensitivityGroup  = par.autofocusSensitivity.newGroup(lut.autofocusSensitivityArray, 2)
const autofocusFrameGroup       = par.autofocusFrame.newGroup(lut.autofocusFrameArray, 2)
const resolutionGroup           = par.resolution.newGroup(lut.resolutionArray)
const hdmiOutputRangeGroup      = par.hdmiOutputRange.newGroup(lut.hdmiOutputRangeArray, 2)
const whiteBalanceModeGroup     = par.whiteBalanceMode.newGroup(lut.whiteBalanceModeArray, 2)
const whiteBalanceRedGainGroup  = par.whiteBalanceRedGain.newGroup(2)
const whiteBalanceBlueGainGroup = par.whiteBalanceBlueGain.newGroup(2)

// const irisPositionGroup = par.irisPosition.newGroup(lut.irisPositionArray)


const commands = {}

const replyFamily = new PacketFamily(undefined,
    new Pattern('X0', [ new Match('X', senderAddressGroup) ]),
    new Pattern('FF')
)

const replies = [
    replyFamily.newChild('Syntax Error', new Pattern('60 02'), undefined, Packet.TYPES.ERROR),
    replyFamily.newChild('Syntax Error (unspecified)', new Pattern('6Y 02', new Match('Y', socketGroup)), undefined, Packet.TYPES.ERROR),
    replyFamily.newChild('Command buffer full', new Pattern('60 03'), undefined, Packet.TYPES.ERROR),
    replyFamily.newChild('Command cancelled', new Pattern('6Y 04', new Match('Y', socketGroup)), undefined, Packet.TYPES.ERROR),
    replyFamily.newChild('No socket (to be cancelled)', new Pattern('6Y 05', new Match('Y', socketGroup)), undefined, Packet.TYPES.ERROR),
]

const viscaCommands = new CommandFamily(undefined,
    new Pattern('8x', [ new Match('x', receiverAddressGroup) ]),
    new Pattern('FF'),
    undefined,
    replies,
    replyFamily
)

const tasks = viscaCommands.newChildFamily(undefined,
    new Pattern('01'),
    undefined,
    Packet.TYPES.TASK,
    [
        viscaCommands.replyFamily.newChild('Ack', new Pattern('4Y', new Match('Y', socketGroup)), undefined, Packet.TYPES.ACK),
        viscaCommands.replyFamily.newChild('Completion', new Pattern('5Y', new Match('Y', socketGroup)), undefined, Packet.TYPES.COMPLETION),
        viscaCommands.replyFamily.newChild('Command not executable', new Pattern('6Y 41', new Match('Y', socketGroup)), undefined, Packet.TYPES.ERROR) 
    ]
)

commands['power'] = tasks.newChild('Power', Pattern.concat(new Pattern('04 00'), Pattern.fromParameterGroup(powerModeGroup)))

const zoom = tasks.newChildFamily('Zoom', new Pattern('04'))
commands['zoom/stop']                 = zoom.newChild('Stop', new Pattern('07 00'))
commands['zoom/tele/standard']        = zoom.newChild('Tele (Standard)', new Pattern('07 02'))
commands['zoom/wide/standard']        = zoom.newChild('Wide (Standard)', new Pattern('07 03'))
commands['zoom/tele/step']            = zoom.newChild('Tele Step', new Pattern('07 04'))
commands['zoom/wide/step']            = zoom.newChild('Wide Step', new Pattern('07 05'))
commands['zoom/tele/variable']        = zoom.newChild('Tele (Variable)', new Pattern('07 2p', new Match('p', zoomAndFocusSpeedGroup)))
commands['zoom/wide/variable']        = zoom.newChild('Wide (Variable)', new Pattern('07 3p', new Match('p', zoomAndFocusSpeedGroup)))
commands['zoom/direct']               = zoom.newChild('Direct', new Pattern('47 0p 0q 0r 0s', new Match('pqrs', zoomPositionGroup)))
commands['zoom/direct/variableSpeed'] = zoom.newChild('Direct (Variable Speed)', new Pattern('47 0p 0q 0r 0s 0t', [ new Match('pqrs', zoomPositionGroup), new Match('t', zoomAndFocusSpeedGroup)]))
commands['zoom/memoryMode']           = zoom.newChild('Memory Mode', Pattern.concat(new Pattern('47 00'), Pattern.fromParameterGroup(zoomMemoryModeGroup)))

const focus = tasks.newChildFamily('Focus', new Pattern('04'))
commands['focus/stop']           = focus.newChild('Stop', new Pattern('08 00'), 'Enabled during Manual Focus Mode')
commands['focus/far/standard']   = focus.newChild('Far (Standard)', new Pattern('08 02'), 'Enabled during Manual Focus Mode')
commands['focus/near/standard']  = focus.newChild('Near (Standard)', new Pattern('08 03'), 'Enabled during Manual Focus Mode')
commands['focus/far/step']       = focus.newChild('Far Step', new Pattern('08 04'), 'Enabled during Manual Focus Mode')
commands['focus/near/step']      = focus.newChild('Near Step', new Pattern('08 05'), 'Enabled during Manual Focus Mode')
commands['focus/far/variable']   = focus.newChild('Far (Variable)', new Pattern('08 2p', new Match('p', zoomAndFocusSpeedGroup)), 'Enabled during Manual Focus Mode')
commands['focus/near/variable']  = focus.newChild('Near (Variable)', new Pattern('08 3p', new Match('p', zoomAndFocusSpeedGroup)), 'Enabled during Manual Focus Mode')
commands['focus/direct']         = focus.newChild('Direct', new Pattern('48 0p 0q 0r 0s', new Match('pqrs', focusPositionGroup)), 'Enabled during Manual Focus Mode')
commands['focus/mode']           = focus.newChild('Mode', Pattern.concat(new Pattern('38'), Pattern.fromParameterGroup(focusModeGroup)))
commands['focus/mode/Toggle']    = focus.newChild('Mode Toggle', new Pattern('38 10'))
commands['focus/onePushTrigger'] = focus.newChild('One Push Trigger', new Pattern('18 01'), 'Enabled during Manual Focus Mode')

commands['curveTracking'] = tasks.newChild('Curve Tracking', Pattern.concat(new Pattern('04 38 03'), Pattern.fromParameterGroup(curveTrackingGroup)))

const autofocus = tasks.newChildFamily('Autofocus', new Pattern('04'))
commands['autofocus/sensitivity'] = autofocus.newChild('Autofocus Sensitivity', Pattern.concat(new Pattern('58'), Pattern.fromParameterGroup(autofocusSensitivityGroup)))
commands['autofocus/frame']       = autofocus.newChild('Autofocus Frame', Pattern.concat(new Pattern('5C'), Pattern.fromParameterGroup(autofocusFrameGroup)))
commands['autofocus/frameToggle'] = autofocus.newChild('Autofocus Frame Toggle', new Pattern('5C 10'))

const zoomAndFocus = tasks.newChildFamily('Zoom and Focus', new Pattern('04'))
commands['zoomAndFocus/direct'] = zoomAndFocus.newChild('Direct', new Pattern('47 0p 0q 0r 0s 0t 0u 0v 0w 0x', [ 
    new Match('pqrs', zoomPositionGroup),
    new Match('tuvw', focusPositionGroup),
    new Match('x', zoomAndFocusSpeedGroup)
]))

commands['initializeLens'] = tasks.newChild('Initialize Lens', new Pattern('04 19 01'))

commands['resolution'] = tasks.newChild('Resolution', new Pattern('06 35 0p 0q', new Match('pq', resolutionGroup)))

commands['hdmiOutputRange'] = tasks.newChild('HDMI Output Range', Pattern.concat(new Pattern('06 37'), Pattern.fromParameterGroup(hdmiOutputRangeGroup)))

const whiteBalance = tasks.newChildFamily('White Balance', new Pattern('04'))
commands['whiteBalance/mode']            = whiteBalance.newChild('Mode', Pattern.concat(new Pattern('35'), Pattern.fromParameterGroup(whiteBalanceModeGroup)))
commands['whiteBalance/onePushTrigger']  = whiteBalance.newChild('One Push Trigger', new Pattern('10 05'), 'Enabled during One Push White Balance Mode')
commands['whiteBalance/redGain/reset']   = whiteBalance.newChild('Red Gain Reset', new Pattern('03 00'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/redGain/up']      = whiteBalance.newChild('Red Gain Up', new Pattern('03 02'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/redGain/down']    = whiteBalance.newChild('Red Gain Down', new Pattern('03 03'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/redGain/direct']  = whiteBalance.newChild('Red Gain Direct', new Pattern('43 00 00 0p 0q', new Match('pq', whiteBalanceRedGainGroup)), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/blueGain/reset']  = whiteBalance.newChild('Blue Gain Reset', new Pattern('04 00'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/blueGain/up']     = whiteBalance.newChild('Blue Gain Up', new Pattern('04 02'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/blueGain/down']   = whiteBalance.newChild('Blue Gain Down', new Pattern('04 03'), 'Enabled during White Balance Manual Mode')
commands['whiteBalance/blueGain/direct'] = whiteBalance.newChild('Blue Gain Direct', new Pattern('44 00 00 0p 0q', new Match('pq', whiteBalanceBlueGainGroup)), 'Enabled during White Balance Manual Mode')

export default commands
