import test from 'node:test'
import assert from 'node:assert'
import { getActionDefinitions } from './actions.js'
import { getFeedbackDefinitions } from './feedbacks.js'
import { getPresetDefinitions } from './presets.js'

const definitions = {
	actions: getActionDefinitions(/** @type {any} */ ({ speed: {} })),
	feedbacks: getFeedbackDefinitions(/** @type {any} */ ({})),
}

test('presets only use existing actions, feedbacks and options', () => {
	const { actions, feedbacks } = definitions
	const { structure, presets } = getPresetDefinitions('cam', [{ number: 1 }, { number: 3 }], definitions)

	// Companion skips actions and feedbacks with missing or invalid option values
	const checkOptions = (definition, options, name) => {
		for (const id of Object.keys(options)) {
			assert.ok(
				definition.options.some((o) => o.id === id),
				`${name}: unknown option ${id}`,
			)
		}
		for (const option of definition.options) {
			const value = options[option.id]
			assert.notStrictEqual(value, undefined, `${name}: option ${option.id} is missing`)
			if (option.type === 'dropdown') {
				assert.ok(
					option.choices.some((choice) => choice.id === value),
					`${name}: invalid value ${value} of ${option.id}`,
				)
			}
			if (option.type === 'number') {
				assert.ok(value >= option.min && value <= option.max, `${name}: ${option.id} ${value} out of range`)
			}
		}
	}

	for (const [presetId, preset] of Object.entries(presets)) {
		assert.strictEqual(preset.type, 'simple')
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
	// Selection buttons for all cameras, the name only for configured ones
	assert.strictEqual(presets.camera_select_8.style.text, 'CAM 8')
	const single = getPresetDefinitions('cam', [{ number: 1 }], definitions).presets
	assert.ok(
		single.camera_select_1 && single.camera_select_8 && single.camera_select_next && single.camera_select_previous,
	)
})

test('preset buttons recall on short press and store when held', () => {
	const [step] = getPresetDefinitions('cam', [], definitions).presets.preset_3.steps
	assert.deepStrictEqual(step.down, [])
	assert.deepStrictEqual(step.up, [{ actionId: 'preset_recall', options: { preset: 3, camera: 0 } }])
	assert.deepStrictEqual(step[2000], {
		options: { runWhileHeld: true },
		actions: [{ actionId: 'preset_set', options: { preset: 3, camera: 0 } }],
	})
})
