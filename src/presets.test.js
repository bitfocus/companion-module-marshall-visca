import test from 'node:test'
import assert from 'node:assert'
import { getActionDefinitions } from './actions.js'
import { getFeedbackDefinitions } from './feedbacks.js'
import { getPresetDefinitions } from './presets.js'

test('presets only use existing actions, feedbacks and options', () => {
	const actions = getActionDefinitions(/** @type {any} */ ({ speed: {} }))
	const feedbacks = getFeedbackDefinitions({})
	const { structure, presets } = getPresetDefinitions('cam', [{ number: 1 }, { number: 3 }])

	const checkOptions = (definition, options, name) => {
		for (const [id, value] of Object.entries(options)) {
			const option = definition.options.find((o) => o.id === id)
			assert.ok(option, `${name}: unknown option ${id}`)
			if (option.type === 'dropdown') {
				assert.ok(
					option.choices.some((choice) => choice.id === value),
					`${name}: invalid value ${value}`,
				)
			}
		}
	}

	for (const [presetId, preset] of Object.entries(presets)) {
		for (const step of preset.steps) {
			// Action sets are arrays (down, up) or { options, actions } for hold durations
			const entries = Object.values(step).flatMap((set) => (Array.isArray(set) ? set : set.actions))
			for (const entry of entries) {
				assert.ok(actions[entry.actionId], `${presetId}: unknown action ${entry.actionId}`)
				checkOptions(actions[entry.actionId], entry.options, presetId)
			}
		}
		for (const entry of preset.feedbacks) {
			assert.ok(feedbacks[entry.feedbackId], `${presetId}: unknown feedback ${entry.feedbackId}`)
			checkOptions(feedbacks[entry.feedbackId], entry.options, presetId)
		}
	}

	const referenced = structure.flatMap((section) => section.definitions)
	assert.deepStrictEqual(new Set(referenced), new Set(Object.keys(presets)))
	assert.match(presets.speed_up.style.text, /\$\(cam:pan_speed\)/)
	assert.match(presets.camera_select_3.style.text, /\$\(cam:cam3_name\)/)
	assert.ok(!getPresetDefinitions('cam', [{ number: 1 }]).presets.camera_select_1, 'no selection for one camera')
})

test('preset buttons recall on short press and store when held', () => {
	const [step] = getPresetDefinitions('cam').presets.preset_3.steps
	assert.deepStrictEqual(step.down, [])
	assert.deepStrictEqual(step.up, [{ actionId: 'preset_recall', options: { preset: 3 } }])
	assert.deepStrictEqual(step[2000], {
		options: { runWhileHeld: true },
		actions: [{ actionId: 'preset_set', options: { preset: 3 } }],
	})
})
