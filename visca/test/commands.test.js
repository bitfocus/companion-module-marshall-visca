import test from 'node:test'
import assert from 'node:assert'
import { Match, Pattern } from '../lib/Packets.js'
import { Range, ParameterGroup } from '../lib/Parameters.js'
import commands, { inquiries } from '../lib/Marshall/commands.js'

const senderAddress = new ParameterGroup(new Range('Address', 1, 7), {
	nHex: 1,
	encoder: (parameterDict) => [parameterDict['Address'] + 8],
	decoder: (hexArray) => ({ Address: hexArray[0] - 8 }),
})

test('pattern writes and reads payloads', () => {
	const pattern = new Pattern('8x 10 42', [new Match('x', senderAddress)])
	assert.deepStrictEqual(pattern.writePayload({ Address: 2 }), [0x8a, 0x10, 0x42])
	assert.deepStrictEqual(pattern.readPayload([0x8a, 0x10, 0x42]), { Address: 2 })
	assert.throws(() => pattern.readPayload([0x8a, 0x11, 0x42]), /does not match/)
})

const payloads = [
	['power', { 'Power Mode': 'On' }, '81 01 04 00 02 FF'],
	['zoom/stop', {}, '81 01 04 07 00 FF'],
	['zoom/tele/variable', { Speed: 5 }, '81 01 04 07 25 FF'],
	['zoom/direct', { 'Zoom Position': 0x1234 }, '81 01 04 47 01 02 03 04 FF'],
	['focus/direct', { 'Focus Position': 234 }, '81 01 04 48 00 00 0E 0A FF'],
	['focus/mode', { 'Focus Mode': 'Manual Focus' }, '81 01 04 38 03 FF'],
	['resolution', { Resolution: 'FHD 1080P(1920 x 1080) - 59.94p' }, '81 01 06 35 00 08 FF'],
	['panTilt/drive', { 'Pan Speed': 0x18, 'Tilt Speed': 0x14, Direction: 'Up Left' }, '81 01 06 01 18 14 01 01 FF'],
	['panTilt/drive', { 'Pan Speed': 1, 'Tilt Speed': 1, Direction: 'Stop' }, '81 01 06 01 01 01 03 03 FF'],
	['panTilt/stop', {}, '81 01 06 01 01 01 03 03 FF'],
	['panTilt/home', {}, '81 01 06 04 FF'],
	['preset/recall', { Preset: 12 }, '81 01 04 3F 02 0C FF'],
	['preset/set', { Preset: 127 }, '81 01 04 3F 01 7F FF'],
	['exposure/mode', { 'AE Mode': 'Manual' }, '81 01 04 39 03 FF'],
	['exposure/iris/direct', { 'Iris Position': 'F2' }, '81 01 04 4B 00 00 00 0D FF'],
	['exposure/gain/up', {}, '81 01 04 0C 02 FF'],
	['exposure/shutter/direct', { 'Shutter Position': 0x12 }, '81 01 04 4A 00 00 01 02 FF'],
	['exposure/compensation', { State: 'On' }, '81 01 04 3E 02 FF'],
	['exposure/compensation/direct', { 'Exposure Compensation': 7 }, '81 01 04 4E 00 00 00 07 FF'],
	['exposure/backlight', { State: 'Off' }, '81 01 04 33 03 FF'],
	['image/aperture/direct', { Aperture: 10 }, '81 01 04 42 00 00 00 0A FF'],
	['image/colorGain', { 'Color Gain': 4 }, '81 01 04 49 00 00 00 04 FF'],
	['image/noiseReduction', { 'Noise Reduction Level': 3 }, '81 01 04 53 03 FF'],
	['image/flip', { State: 'On' }, '81 01 04 66 02 FF'],
	['image/defog', { State: 'On' }, '81 01 04 37 02 00 FF'],
	[
		'panTilt/absolute',
		{ 'Pan Speed': 0x10, 'Tilt Speed': 0x0a, 'Pan Position': -0x100, 'Tilt Position': 0x50 },
		'81 01 06 02 10 0A 0F 0F 00 00 00 00 05 00 FF',
	],
	[
		'panTilt/limit/set',
		{ Corner: 'Up Right', 'Pan Position': 0x200, 'Tilt Position': -1 },
		'81 01 06 07 00 01 00 02 00 00 0F 0F 0F 0F FF',
	],
	['panTilt/limit/clear', { Corner: 'Down Left' }, '81 01 06 07 01 00 07 0F 0F 0F 07 0F 0F 0F FF'],
	['menu/toggle', {}, '81 01 06 06 10 FF'],
	['tally', { State: 'On' }, '81 01 7E 01 0A 00 02 FF'],
	['whiteBalance/redGain/direct', { 'White Balance Red Gain': 0x40 }, '81 01 04 43 00 00 04 00 FF'],
]

for (const [key, parameterDict, expected] of payloads) {
	test(`command ${key} creates the expected payload`, () => {
		const command = commands[key]
		assert.ok(command, `command ${key} exists`)
		const payload = command.pattern.writePayload({ Address: 1, ...parameterDict })
		assert.strictEqual(Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' '), expected)
	})
}

test('replies of tasks are identified', () => {
	const command = commands['power']
	const identify = (payload) =>
		command.replies.find((reply) => {
			try {
				reply.pattern.readPayload(payload)
				return true
			} catch {
				return false
			}
		})?.name
	assert.strictEqual(identify([0x90, 0x41, 0xff]), 'Ack')
	assert.strictEqual(identify([0x90, 0x51, 0xff]), 'Completion')
	assert.strictEqual(identify([0x90, 0x61, 0x41, 0xff]), 'Command not executable')
	assert.strictEqual(identify([0x90, 0x60, 0x02, 0xff]), 'Syntax Error')
})

test('every command has unique parameter names', () => {
	for (const [key, command] of Object.entries(commands)) {
		const names = [...command.pattern.getParameters()].map((parameter) => parameter.name)
		assert.strictEqual(new Set(names).size, names.length, key)
	}
})

const hex = (payload) => Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' ')
const bytes = (hexString) => [...Buffer.from(hexString.replace(/\s+/g, ''), 'hex')]

const answers = [
	['power', '81 09 04 00 FF', '90 50 02 FF', { 'Power Mode': 'On' }],
	['zoomPosition', '81 09 04 47 FF', '90 50 07 0A 0C 00 FF', { 'Zoom Position': 0x7ac0 }],
	['focusMode', '81 09 04 38 FF', '90 50 03 FF', { 'Focus Mode': 'Manual Focus' }],
	['aeMode', '81 09 04 39 FF', '90 50 0B FF', { 'AE Mode': 'Iris Priority' }],
	['irisPosition', '81 09 04 4B FF', '90 50 00 00 01 05 FF', { Position: 0x15 }],
	[
		'panTiltPosition',
		'81 09 06 12 FF',
		'90 50 0F 0F 0F 0E 00 01 02 03 FF',
		{ 'Pan Position': -2, 'Tilt Position': 0x0123 },
	],
	[
		'version',
		'81 09 00 02 FF',
		'90 50 00 01 05 13 01 04 02 FF',
		{ 'Vendor ID': '0001', 'Model ID': '0513', 'ROM Version': '0104', 'Maximum Socket': 2 },
	],
]

for (const [key, request, reply, parameterDict] of answers) {
	test(`inquiry ${key} is sent and answered`, () => {
		const inquiry = inquiries[key]
		assert.strictEqual(hex(inquiry.pattern.writePayload({ Address: 1 })), request)
		const answer = inquiry.replies.find((packet) => packet.name === 'Answer')
		assert.deepStrictEqual(answer.pattern.readPayload(bytes(reply)), { Address: 1, ...parameterDict })
	})
}
