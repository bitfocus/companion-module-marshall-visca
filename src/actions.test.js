import test from 'node:test'
import assert from 'node:assert'
import { getActionDefinitions, getCommandActionDefinitions, toId } from './actions.js'
import { getModel } from './models.js'

function createSelf(model) {
	const self = {
		sent: [],
		logs: [],
		model,
		speed: { pan: 12, tilt: 10, zoom: 4 },
		sendCommand: (command, parameterDict) => self.sent.push({ command, parameterDict }),
		setSpeed: (speed) => (self.speed = speed),
		log: (level, message) => self.logs.push([level, message]),
		state: {},
		updateState: (values) => Object.assign(self.state, values),
	}
	return self
}

test('toId creates safe ids', () => {
	assert.strictEqual(toId('zoomAndFocus/direct'), 'zoom_and_focus_direct')
	assert.strictEqual(toId('White Balance Red Gain'), 'white_balance_red_gain')
})

test('every command action encodes its default options into a valid payload', () => {
	const self = createSelf()
	const actions = getCommandActionDefinitions(self)
	assert.ok(Object.keys(actions).length > 80)

	for (const [id, action] of Object.entries(actions)) {
		assert.match(id, /^[a-z0-9_]+$/)
		assert.ok(!action.options.some((option) => option.id === 'address'), `${id} must not expose the address`)

		const options = Object.fromEntries(action.options.map((option) => [option.id, option.default]))
		action.callback({ options })
		const { command, parameterDict } = self.sent.pop()
		const payload = command.pattern.writePayload({ Address: 1, ...parameterDict })
		assert.strictEqual(payload[0], 0x81, id)
		assert.strictEqual(payload.at(-1), 0xff, id)
	}
})

test('number options from expressions are converted', () => {
	const self = createSelf()
	getActionDefinitions(self).preset_recall.callback({ options: { preset: '12' } })
	assert.deepStrictEqual(self.sent[0].parameterDict, { Preset: 12 })
})

test('signed positions default to 0', () => {
	const option = getActionDefinitions(createSelf()).pan_tilt_absolute.options.find((o) => o.id === 'pan_position')
	assert.strictEqual(option.default, 0)
	assert.strictEqual(option.min, -0x8000)
})

test('Full HD models do not offer UHD resolutions', () => {
	const resolutions = (model) =>
		getActionDefinitions(createSelf(model)).resolution.options[0].choices.map((choice) => choice.id)
	assert.ok(resolutions(getModel('cv630')).some((id) => id.startsWith('QFHD')))
	assert.ok(!resolutions(getModel('cv612')).some((id) => id.startsWith('QFHD')))
	assert.ok(resolutions(getModel('unknown')).some((id) => id.startsWith('QFHD')))
})

test('speed actions change the module speed within the limits', () => {
	const self = createSelf()
	const actions = getActionDefinitions(self)
	actions.speed_increase.callback({ options: { axis: 'pan_tilt', step: 20 } })
	assert.deepStrictEqual(self.speed, { pan: 0x18, tilt: 0x14, zoom: 4 })
	actions.speed_decrease.callback({ options: { axis: 'all', step: 30 } })
	assert.deepStrictEqual(self.speed, { pan: 1, tilt: 1, zoom: 0 })
	actions.speed_set.callback({ options: { pan_speed: 5, tilt_speed: 6, speed: 7 } })
	assert.deepStrictEqual(self.speed, { pan: 5, tilt: 6, zoom: 7 })

	actions.pan_tilt_move.callback({ options: { direction: 'Left' } })
	assert.deepStrictEqual(self.sent.at(-1).parameterDict, { 'Pan Speed': 5, 'Tilt Speed': 6, Direction: 'Left' })
	actions.zoom_move.callback({ options: { direction: 'wide' } })
	assert.strictEqual(self.sent.at(-1).command.name, 'Wide (Variable)')
	assert.deepStrictEqual(self.sent.at(-1).parameterDict, { Speed: 7 })
})

test('custom command sends valid commands and logs invalid ones', () => {
	const self = createSelf()
	const actions = getActionDefinitions(self)
	actions.custom_command.callback({ options: { command: '81 01 04 07 02 FF' } })
	assert.strictEqual(self.sent.length, 1)
	actions.custom_command.callback({ options: { command: '81 09 04 00 FF' } })
	assert.strictEqual(self.sent.length, 1)
	assert.strictEqual(self.logs[0][0], 'warn')
})

test('image adjust steps color gain and hue from the current value', () => {
	const self = createSelf()
	const actions = getActionDefinitions(self)
	actions.image_adjust.callback({ options: { setting: 'color_gain', step: 1 } })
	assert.strictEqual(self.sent.length, 0, 'unknown value is not adjusted')
	assert.strictEqual(self.logs[0][0], 'warn')

	self.state.color_gain = 13
	actions.image_adjust.callback({ options: { setting: 'color_gain', step: 1 } })
	actions.image_adjust.callback({ options: { setting: 'color_gain', step: 1 } })
	assert.deepStrictEqual(
		self.sent.map(({ parameterDict }) => parameterDict),
		[{ 'Color Gain': 14 }, { 'Color Gain': 14 }],
	)

	self.state.hue = 7
	actions.image_adjust.callback({ options: { setting: 'hue', step: -2 } })
	assert.strictEqual(self.sent.at(-1).command.name, 'Hue')
	assert.deepStrictEqual(self.sent.at(-1).parameterDict, { Hue: 5 })
	assert.strictEqual(self.state.hue, 5)
})
