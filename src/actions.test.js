import test from 'node:test'
import assert from 'node:assert'
import { getActionDefinitions, toId } from './actions.js'

test('toId creates safe ids', () => {
	assert.strictEqual(toId('zoomAndFocus/direct'), 'zoom_and_focus_direct')
	assert.strictEqual(toId('White Balance Red Gain'), 'white_balance_red_gain')
})

test('every action encodes its default options into a valid payload', () => {
	const sent = []
	const actions = getActionDefinitions((command, parameterDict) => sent.push({ command, parameterDict }))
	assert.ok(Object.keys(actions).length > 40)

	for (const [id, action] of Object.entries(actions)) {
		assert.match(id, /^[a-z0-9_]+$/)
		assert.ok(!action.options.some((option) => option.id === 'address'), `${id} must not expose the address`)

		const options = Object.fromEntries(action.options.map((option) => [option.id, option.default]))
		action.callback({ options })
		const { command, parameterDict } = sent.pop()
		const payload = command.pattern.writePayload({ Address: 1, ...parameterDict })
		assert.strictEqual(payload[0], 0x81, id)
		assert.strictEqual(payload.at(-1), 0xff, id)
	}
})

test('number options from expressions are converted', () => {
	const sent = []
	const actions = getActionDefinitions((command, parameterDict) => sent.push(parameterDict))
	actions.preset_recall.callback({ options: { preset: '12' } })
	assert.deepStrictEqual(sent[0], { Preset: 12 })
})
