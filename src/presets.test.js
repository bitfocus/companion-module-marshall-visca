import test from 'node:test'
import assert from 'node:assert'
import { getActionDefinitions } from './actions.js'
import { getFeedbackDefinitions } from './feedbacks.js'
import { getPresetDefinitions } from './presets.js'

test('presets only use existing actions, feedbacks and options', () => {
	const actions = getActionDefinitions({ speed: {} })
	const feedbacks = getFeedbackDefinitions({})
	const { structure, presets } = getPresetDefinitions('cam')

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
			for (const entry of [...step.down, ...step.up]) {
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
})
