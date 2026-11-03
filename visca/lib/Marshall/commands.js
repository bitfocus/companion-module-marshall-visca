import { Command, CommandFamily, PacketFamily, Packet, Pattern, Match } from '../Packets.js'
import { ParameterGroup } from '../Parameters.js'

import * as lut from './lookupTables.js'
import * as par from './parameters.js'

const senderAddressGroup = new ParameterGroup(par.addressParameter, {
	nHex: 1,
	encoder: (parameterDict) => [parameterDict['Address'] + 8],
	decoder: (hexArray) => ({ Address: hexArray[0] - 8 }),
})
const receiverAddressGroup = par.addressParameter.newGroup()
const socketGroup = par.socket.newGroup()

const powerModeGroup = par.powerMode.newGroup(lut.powerModeArray, 2)
const zoomAndFocusSpeedGroup = par.zoomAndFocusSpeed.newGroup()
const zoomPositionGroup = par.zoomPosition.newGroup()
const zoomMemoryModeGroup = par.zoomMemoryMode.newGroup(lut.defaultOnOffArray, 2)
const focusPositionGroup = par.focusPosition.newGroup(4)
const focusModeGroup = par.focusMode.newGroup(lut.focusModeArray, 2)
const curveTrackingGroup = par.curveTracking.newGroup(lut.curveTrackingArray, 2)
const autofocusSensitivityGroup = par.autofocusSensitivity.newGroup(lut.autofocusSensitivityArray, 2)
const autofocusFrameGroup = par.autofocusFrame.newGroup(lut.autofocusFrameArray, 2)
const resolutionGroup = par.resolution.newGroup(lut.resolutionArray)
const hdmiOutputRangeGroup = par.hdmiOutputRange.newGroup(lut.hdmiOutputRangeArray, 2)
const whiteBalanceModeGroup = par.whiteBalanceMode.newGroup(lut.whiteBalanceModeArray, 2)
const whiteBalanceRedGainGroup = par.whiteBalanceRedGain.newGroup(2)
const whiteBalanceBlueGainGroup = par.whiteBalanceBlueGain.newGroup(2)
const panSpeedGroup = par.panSpeed.newGroup(2)
const tiltSpeedGroup = par.tiltSpeed.newGroup(2)
const panTiltDirectionGroup = par.panTiltDirection.newGroup(lut.panTiltDirectionArray, 2)
const presetNumberGroup = par.presetNumber.newGroup(2)
const aeModeGroup = par.aeMode.newGroup(lut.aeModeArray, 2)
const panPositionGroup = par.panPosition.newGroup(4)
const tiltPositionGroup = par.tiltPosition.newGroup(4)
const onOffGroup = par.onOff.newGroup(lut.defaultOnOffArray, 2)
const irisPositionGroup = par.irisPosition.newGroup(lut.irisPositionArray, 2)
const panTiltLimitCornerGroup = par.panTiltLimitCorner.newGroup(lut.panTiltLimitCornerArray, 1)

const commands = {}

const replyFamily = new PacketFamily(
	undefined,
	new Pattern('X0', [new Match('X', senderAddressGroup)]),
	new Pattern('FF'),
)

const replies = [
	replyFamily.newChild('Syntax Error', new Pattern('60 02'), undefined, Packet.TYPES.ERROR),
	replyFamily.newChild(
		'Syntax Error (unspecified)',
		new Pattern('6Y 02', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.ERROR,
	),
	replyFamily.newChild('Command buffer full', new Pattern('60 03'), undefined, Packet.TYPES.ERROR),
	replyFamily.newChild(
		'Command cancelled',
		new Pattern('6Y 04', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.ERROR,
	),
	replyFamily.newChild(
		'No socket (to be cancelled)',
		new Pattern('6Y 05', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.ERROR,
	),
]

const viscaCommands = new CommandFamily(
	undefined,
	new Pattern('8x', [new Match('x', receiverAddressGroup)]),
	new Pattern('FF'),
	undefined,
	replies,
	replyFamily,
)

const tasks = viscaCommands.newChildFamily(undefined, new Pattern('01'), undefined, Packet.TYPES.TASK, [
	viscaCommands.replyFamily.newChild(
		'Ack',
		new Pattern('4Y', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.ACK,
	),
	viscaCommands.replyFamily.newChild(
		'Completion',
		new Pattern('5Y', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.COMPLETION,
	),
	viscaCommands.replyFamily.newChild(
		'Command not executable',
		new Pattern('6Y 41', new Match('Y', socketGroup)),
		undefined,
		Packet.TYPES.ERROR,
	),
])

commands['power'] = tasks.newChild(
	'Power',
	Pattern.concat(new Pattern('04 00'), Pattern.fromParameterGroup(powerModeGroup)),
)

const zoom = tasks.newChildFamily('Zoom', new Pattern('04'))
commands['zoom/stop'] = zoom.newChild('Stop', new Pattern('07 00'))
commands['zoom/tele/standard'] = zoom.newChild('Tele (Standard)', new Pattern('07 02'))
commands['zoom/wide/standard'] = zoom.newChild('Wide (Standard)', new Pattern('07 03'))
commands['zoom/tele/step'] = zoom.newChild('Tele Step', new Pattern('07 04'))
commands['zoom/wide/step'] = zoom.newChild('Wide Step', new Pattern('07 05'))
commands['zoom/tele/variable'] = zoom.newChild(
	'Tele (Variable)',
	new Pattern('07 2p', new Match('p', zoomAndFocusSpeedGroup)),
)
commands['zoom/wide/variable'] = zoom.newChild(
	'Wide (Variable)',
	new Pattern('07 3p', new Match('p', zoomAndFocusSpeedGroup)),
)
commands['zoom/direct'] = zoom.newChild('Direct', new Pattern('47 0p 0q 0r 0s', new Match('pqrs', zoomPositionGroup)))
commands['zoom/direct/variableSpeed'] = zoom.newChild(
	'Direct (Variable Speed)',
	new Pattern('47 0p 0q 0r 0s 0t', [new Match('pqrs', zoomPositionGroup), new Match('t', zoomAndFocusSpeedGroup)]),
)
commands['zoom/memoryMode'] = zoom.newChild(
	'Memory Mode',
	Pattern.concat(new Pattern('47 00'), Pattern.fromParameterGroup(zoomMemoryModeGroup)),
)

const focus = tasks.newChildFamily('Focus', new Pattern('04'))
commands['focus/stop'] = focus.newChild('Stop', new Pattern('08 00'), 'Enabled during Manual Focus Mode')
commands['focus/far/standard'] = focus.newChild(
	'Far (Standard)',
	new Pattern('08 02'),
	'Enabled during Manual Focus Mode',
)
commands['focus/near/standard'] = focus.newChild(
	'Near (Standard)',
	new Pattern('08 03'),
	'Enabled during Manual Focus Mode',
)
commands['focus/far/step'] = focus.newChild('Far Step', new Pattern('08 04'), 'Enabled during Manual Focus Mode')
commands['focus/near/step'] = focus.newChild('Near Step', new Pattern('08 05'), 'Enabled during Manual Focus Mode')
commands['focus/far/variable'] = focus.newChild(
	'Far (Variable)',
	new Pattern('08 2p', new Match('p', zoomAndFocusSpeedGroup)),
	'Enabled during Manual Focus Mode',
)
commands['focus/near/variable'] = focus.newChild(
	'Near (Variable)',
	new Pattern('08 3p', new Match('p', zoomAndFocusSpeedGroup)),
	'Enabled during Manual Focus Mode',
)
commands['focus/direct'] = focus.newChild(
	'Direct',
	new Pattern('48 0p 0q 0r 0s', new Match('pqrs', focusPositionGroup)),
	'Enabled during Manual Focus Mode',
)
commands['focus/mode'] = focus.newChild(
	'Mode',
	Pattern.concat(new Pattern('38'), Pattern.fromParameterGroup(focusModeGroup)),
)
commands['focus/mode/Toggle'] = focus.newChild('Mode Toggle', new Pattern('38 10'))
commands['focus/onePushTrigger'] = focus.newChild(
	'One Push Trigger',
	new Pattern('18 01'),
	'Enabled during Manual Focus Mode',
)

commands['curveTracking'] = tasks.newChild(
	'Curve Tracking',
	Pattern.concat(new Pattern('04 38 03'), Pattern.fromParameterGroup(curveTrackingGroup)),
)

const autofocus = tasks.newChildFamily('Autofocus', new Pattern('04'))
commands['autofocus/sensitivity'] = autofocus.newChild(
	'Autofocus Sensitivity',
	Pattern.concat(new Pattern('58'), Pattern.fromParameterGroup(autofocusSensitivityGroup)),
)
commands['autofocus/frame'] = autofocus.newChild(
	'Autofocus Frame',
	Pattern.concat(new Pattern('5C'), Pattern.fromParameterGroup(autofocusFrameGroup)),
)
commands['autofocus/frameToggle'] = autofocus.newChild('Autofocus Frame Toggle', new Pattern('5C 10'))

const zoomAndFocus = tasks.newChildFamily('Zoom and Focus', new Pattern('04'))
commands['zoomAndFocus/direct'] = zoomAndFocus.newChild(
	'Direct',
	new Pattern('47 0p 0q 0r 0s 0t 0u 0v 0w 0x', [
		new Match('pqrs', zoomPositionGroup),
		new Match('tuvw', focusPositionGroup),
		new Match('x', zoomAndFocusSpeedGroup),
	]),
)

commands['initializeLens'] = tasks.newChild('Initialize Lens', new Pattern('04 19 01'))

commands['resolution'] = tasks.newChild('Resolution', new Pattern('06 35 0p 0q', new Match('pq', resolutionGroup)))

commands['hdmiOutputRange'] = tasks.newChild(
	'HDMI Output Range',
	Pattern.concat(new Pattern('06 37'), Pattern.fromParameterGroup(hdmiOutputRangeGroup)),
)

const whiteBalance = tasks.newChildFamily('White Balance', new Pattern('04'))
commands['whiteBalance/mode'] = whiteBalance.newChild(
	'Mode',
	Pattern.concat(new Pattern('35'), Pattern.fromParameterGroup(whiteBalanceModeGroup)),
)
commands['whiteBalance/onePushTrigger'] = whiteBalance.newChild(
	'One Push Trigger',
	new Pattern('10 05'),
	'Enabled during One Push White Balance Mode',
)
commands['whiteBalance/redGain/reset'] = whiteBalance.newChild(
	'Red Gain Reset',
	new Pattern('03 00'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/redGain/up'] = whiteBalance.newChild(
	'Red Gain Up',
	new Pattern('03 02'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/redGain/down'] = whiteBalance.newChild(
	'Red Gain Down',
	new Pattern('03 03'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/redGain/direct'] = whiteBalance.newChild(
	'Red Gain Direct',
	new Pattern('43 00 00 0p 0q', new Match('pq', whiteBalanceRedGainGroup)),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/blueGain/reset'] = whiteBalance.newChild(
	'Blue Gain Reset',
	new Pattern('04 00'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/blueGain/up'] = whiteBalance.newChild(
	'Blue Gain Up',
	new Pattern('04 02'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/blueGain/down'] = whiteBalance.newChild(
	'Blue Gain Down',
	new Pattern('04 03'),
	'Enabled during White Balance Manual Mode',
)
commands['whiteBalance/blueGain/direct'] = whiteBalance.newChild(
	'Blue Gain Direct',
	new Pattern('44 00 00 0p 0q', new Match('pq', whiteBalanceBlueGainGroup)),
	'Enabled during White Balance Manual Mode',
)

const panTilt = tasks.newChildFamily('Pan Tilt', new Pattern('06'))
commands['panTilt/drive'] = panTilt.newChild(
	'Drive',
	new Pattern('01 pp tt 0y 0z', [
		new Match('pp', panSpeedGroup),
		new Match('tt', tiltSpeedGroup),
		new Match('yz', panTiltDirectionGroup),
	]),
)
commands['panTilt/stop'] = panTilt.newChild('Stop', new Pattern('01 01 01 03 03'))
commands['panTilt/home'] = panTilt.newChild('Home', new Pattern('04'))
commands['panTilt/reset'] = panTilt.newChild('Reset', new Pattern('05'), 'Recalibrates the pan/tilt mechanics')

const preset = tasks.newChildFamily('Preset', new Pattern('04 3F'))
commands['preset/recall'] = preset.newChild('Recall', new Pattern('02 pq', new Match('pq', presetNumberGroup)))
commands['preset/set'] = preset.newChild('Set', new Pattern('01 pq', new Match('pq', presetNumberGroup)))
commands['preset/reset'] = preset.newChild(
	'Reset',
	new Pattern('00 pq', new Match('pq', presetNumberGroup)),
	'Clears the stored preset',
)

const addOnOff = (family, key, name, code, comment) => {
	commands[key] = family.newChild(
		name,
		Pattern.concat(new Pattern(code), Pattern.fromParameterGroup(onOffGroup)),
		comment,
	)
}

/**
 * Adds reset, up, down and direct commands of a value like gain or iris
 */
const addAdjustable = (family, key, name, code, directCode, group, comment) => {
	commands[`${key}/reset`] = family.newChild(`${name} Reset`, new Pattern(`${code} 00`), comment)
	commands[`${key}/up`] = family.newChild(`${name} Up`, new Pattern(`${code} 02`), comment)
	commands[`${key}/down`] = family.newChild(`${name} Down`, new Pattern(`${code} 03`), comment)
	commands[`${key}/direct`] = family.newChild(
		`${name} Direct`,
		new Pattern(`${directCode} 00 00 0p 0q`, new Match('pq', group)),
		comment,
	)
}

const exposure = tasks.newChildFamily('Exposure', new Pattern('04'))
commands['exposure/mode'] = exposure.newChild(
	'AE Mode',
	Pattern.concat(new Pattern('39'), Pattern.fromParameterGroup(aeModeGroup)),
)
addAdjustable(exposure, 'exposure/iris', 'Iris', '0B', '4B', irisPositionGroup, 'Manual or Iris Priority mode')
addAdjustable(
	exposure,
	'exposure/shutter',
	'Shutter',
	'0A',
	'4A',
	par.shutterPosition.newGroup(2),
	'Manual or Shutter Priority mode',
)
addAdjustable(exposure, 'exposure/gain', 'Gain', '0C', '4C', par.gainPosition.newGroup(2), 'Manual mode')
addAdjustable(exposure, 'exposure/bright', 'Bright', '0D', '4D', par.brightPosition.newGroup(2), 'Bright mode')
addOnOff(exposure, 'exposure/compensation', 'Exposure Compensation', '3E')
addAdjustable(
	exposure,
	'exposure/compensation',
	'Exposure Compensation',
	'0E',
	'4E',
	par.exposureCompensation.newGroup(2),
	'Exposure Compensation on',
)
addOnOff(exposure, 'exposure/backlight', 'Backlight Compensation', '33')
addOnOff(exposure, 'exposure/wdr', 'Wide Dynamic Range', '3D')

const image = tasks.newChildFamily('Image', new Pattern('04'))
addAdjustable(image, 'image/aperture', 'Aperture', '02', '42', par.aperture.newGroup(2))
commands['image/colorGain'] = image.newChild(
	'Color Gain',
	new Pattern('49 00 00 00 0p', new Match('p', par.colorGain.newGroup(1))),
)
commands['image/gamma'] = image.newChild('Gamma', new Pattern('5B 0p', new Match('p', par.gamma.newGroup(1))))
commands['image/noiseReduction'] = image.newChild(
	'Noise Reduction',
	new Pattern('53 0p', new Match('p', par.noiseReduction.newGroup(1))),
)
addOnOff(image, 'image/flip', 'Flip', '66')
addOnOff(image, 'image/mirror', 'Mirror', '61')
commands['image/defog'] = image.newChild(
	'Defog',
	Pattern.concat(new Pattern('37'), Pattern.fromParameterGroup(onOffGroup), new Pattern('00')),
)
addOnOff(image, 'image/freeze', 'Picture Freeze', '62')

commands['panTilt/absolute'] = panTilt.newChild(
	'Absolute Position',
	new Pattern('02 vv ww 0p 0p 0p 0p 0t 0t 0t 0t', [
		new Match('vv', panSpeedGroup),
		new Match('ww', tiltSpeedGroup),
		new Match('pppp', panPositionGroup),
		new Match('tttt', tiltPositionGroup),
	]),
)
commands['panTilt/relative'] = panTilt.newChild(
	'Relative Position',
	new Pattern('03 vv ww 0p 0p 0p 0p 0t 0t 0t 0t', [
		new Match('vv', panSpeedGroup),
		new Match('ww', tiltSpeedGroup),
		new Match('pppp', panPositionGroup),
		new Match('tttt', tiltPositionGroup),
	]),
)
commands['panTilt/limit/set'] = panTilt.newChild(
	'Limit Set',
	new Pattern('07 00 0k 0p 0p 0p 0p 0t 0t 0t 0t', [
		new Match('k', panTiltLimitCornerGroup),
		new Match('pppp', panPositionGroup),
		new Match('tttt', tiltPositionGroup),
	]),
)
commands['panTilt/limit/clear'] = panTilt.newChild(
	'Limit Clear',
	new Pattern('07 01 0k 07 0F 0F 0F 07 0F 0F 0F', new Match('k', panTiltLimitCornerGroup)),
)

const menu = tasks.newChildFamily('Menu', new Pattern('06 06'))
commands['menu/on'] = menu.newChild('On', new Pattern('02'), 'Navigate with Pan Tilt - Drive')
commands['menu/off'] = menu.newChild('Off', new Pattern('03'))
commands['menu/toggle'] = menu.newChild('Toggle', new Pattern('10'), 'Navigate with Pan Tilt - Drive')

addOnOff(tasks, 'tally', 'Tally', '7E 01 0A 00', 'Sony compatible tally lamp, not available on every model')

/**
 * Creates a command from a hex string like '81 01 04 07 02 FF', for commands that are not defined here.
 * Only commands (8x 01 ...) are supported, as the answer of an inquiry cannot be parsed without its definition.
 *
 * @throws If the hex string is not a valid VISCA command.
 */
export function createCustomCommand(hexString) {
	const hex = hexString.replace(/\s+/g, '').toUpperCase()
	if (!/^([0-9A-F]{2})+$/.test(hex)) {
		throw new Error('The command must consist of pairs of hexadecimal digits')
	}
	if (!/^8[1-7]01([0-9A-F]{2})*FF$/.test(hex) || hex.match(/../g).slice(0, -1).includes('FF')) {
		throw new Error('The command must start with 8x 01 and end with FF (and must not contain FF otherwise)')
	}
	return new Command('Custom Command', undefined, Packet.TYPES.TASK, new Pattern(hex), hexString, tasks.replies)
}

/**
 * Inquiries, answered with '90 50 ... FF'
 */
export const inquiries = {}

const inquiryFamily = viscaCommands.newChildFamily(undefined, new Pattern('09'), undefined, Packet.TYPES.INQUERY, [
	viscaCommands.replyFamily.newChild('Command not executable', new Pattern('60 41'), undefined, Packet.TYPES.ERROR),
])

const answer = (...patterns) =>
	viscaCommands.replyFamily.newChild(
		'Answer',
		Pattern.concat(new Pattern('50'), ...patterns),
		undefined,
		Packet.TYPES.ANSWER,
	)
const addInquiry = (key, name, core, ...answerPatterns) => {
	inquiries[key] = inquiryFamily.newChild(name, new Pattern(core), undefined, Packet.TYPES.INQUERY, [
		answer(...answerPatterns),
	])
}

// Cameras report values that are not documented (e.g. focus mode 04), they are decoded as 'Unknown (0x..)'
const answerGroup = (parameter, lookupTable) => parameter.newGroup(lookupTable, 2, { allowUnknown: true })

addInquiry('power', 'Power', '04 00', Pattern.fromParameterGroup(answerGroup(par.powerMode, lut.powerModeArray)))
addInquiry(
	'zoomPosition',
	'Zoom Position',
	'04 47',
	new Pattern('0p 0q 0r 0s', new Match('pqrs', par.zoomPositionAnswer.newGroup(4))),
)
addInquiry(
	'focusPosition',
	'Focus Position',
	'04 48',
	new Pattern('0p 0q 0r 0s', new Match('pqrs', par.focusPositionAnswer.newGroup(4))),
)
addInquiry(
	'focusMode',
	'Focus Mode',
	'04 38',
	Pattern.fromParameterGroup(answerGroup(par.focusMode, lut.focusModeArray)),
)
addInquiry(
	'whiteBalanceMode',
	'White Balance Mode',
	'04 35',
	Pattern.fromParameterGroup(answerGroup(par.whiteBalanceMode, lut.whiteBalanceModeArray)),
)
addInquiry('aeMode', 'AE Mode', '04 39', Pattern.fromParameterGroup(answerGroup(par.aeMode, lut.aeModeArray)))
for (const [key, name, core] of [
	['irisPosition', 'Iris Position', '04 4B'],
	['shutterPosition', 'Shutter Position', '04 4A'],
	['gainPosition', 'Gain Position', '04 4C'],
	['brightPosition', 'Bright Position', '04 4D'],
]) {
	addInquiry(key, name, core, new Pattern('00 00 0p 0q', new Match('pq', par.positionAnswer.newGroup(2))))
}
addInquiry(
	'panTiltPosition',
	'Pan Tilt Position',
	'06 12',
	new Pattern('0p 0p 0p 0p 0t 0t 0t 0t', [new Match('pppp', panPositionGroup), new Match('tttt', tiltPositionGroup)]),
)
addInquiry(
	'version',
	'Version',
	'00 02',
	new Pattern('vv vv mm mm rr rr ss', [
		new Match('vvvv', par.vendorId.newGroup()),
		new Match('mmmm', par.modelId.newGroup()),
		new Match('rrrr', par.romVersion.newGroup()),
		new Match('ss', par.maximumSocket.newGroup(2)),
	]),
)

export default commands
