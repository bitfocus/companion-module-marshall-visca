// @ts-check
import { combineRgb } from '@companion-module/base'
import * as lut from '../visca/lib/Marshall/lookupTables.js'

const activeStyle = { bgcolor: combineRgb(0, 153, 0), color: combineRgb(255, 255, 255) }

const choices = (lookupTable) => Object.keys(lookupTable).map((name) => ({ id: name, label: name }))

/**
 * @param {Record<string, unknown>} state
 * @param {string} name
 * @param {string} variableId
 * @param {Record<string, number>} lookupTable
 * @returns {import('@companion-module/base').CompanionBooleanFeedbackDefinition}
 */
function modeFeedback(state, name, variableId, lookupTable) {
	const modes = choices(lookupTable)
	return {
		type: 'boolean',
		name,
		defaultStyle: activeStyle,
		options: [{ type: 'dropdown', id: 'mode', label: 'Mode', choices: modes, default: modes[0].id }],
		callback: ({ options }) => state[variableId] === options.mode,
	}
}

/**
 * @param {Record<string, unknown>} state  Current variable values of the instance.
 * @returns {import('@companion-module/base').CompanionFeedbackDefinitions}
 */
export function getFeedbackDefinitions(state) {
	return {
		power_on: {
			type: 'boolean',
			name: 'Power is on',
			defaultStyle: activeStyle,
			options: [],
			callback: () => state.power === 'On',
		},
		preset_active: {
			type: 'boolean',
			name: 'Preset was recalled last',
			description: 'Active until the camera is moved manually or another preset is recalled',
			defaultStyle: activeStyle,
			options: [{ type: 'number', id: 'preset', label: 'Preset', min: 0, max: 127, default: 0, asInteger: true }],
			callback: ({ options }) => state.last_preset !== '' && state.last_preset === Number(options.preset),
		},
		focus_mode: modeFeedback(state, 'Focus mode', 'focus_mode', lut.focusModeArray),
		white_balance_mode: modeFeedback(state, 'White balance mode', 'white_balance_mode', lut.whiteBalanceModeArray),
		ae_mode: modeFeedback(state, 'AE mode', 'ae_mode', lut.aeModeArray),
	}
}

/**
 * Feedbacks to check when a variable changes.
 *
 * @type {Record<string, string[]>}
 */
export const FeedbacksByVariable = {
	power: ['power_on'],
	last_preset: ['preset_active'],
	focus_mode: ['focus_mode'],
	white_balance_mode: ['white_balance_mode'],
	ae_mode: ['ae_mode'],
}
