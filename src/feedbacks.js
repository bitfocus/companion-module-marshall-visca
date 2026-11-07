// @ts-check
import { combineRgb } from '@companion-module/base'
import * as lut from '../visca/lib/Marshall/lookupTables.js'
import { cameraOption } from './camera-option.js'

const activeStyle = { bgcolor: combineRgb(0, 153, 0), color: combineRgb(255, 255, 255) }

const choices = (lookupTable) => Object.keys(lookupTable).map((name) => ({ id: name, label: name }))

/**
 * @typedef {object} FeedbackContext  The module instance, or a stub in tests
 * @property {(camera: number) => Record<string, unknown>} getCameraState  0 for the selected camera
 * @property {number} selectedCamera
 */

/**
 * @param {FeedbackContext} self
 * @param {string} name
 * @param {string} variableId
 * @param {Record<string, number>} lookupTable
 * @returns {import('@companion-module/base').CompanionBooleanFeedbackDefinition}
 */
function modeFeedback(self, name, variableId, lookupTable) {
	const modes = choices(lookupTable)
	return {
		type: 'boolean',
		name,
		defaultStyle: activeStyle,
		options: [{ type: 'dropdown', id: 'mode', label: 'Mode', choices: modes, default: modes[0].id }, cameraOption],
		callback: ({ options }) => self.getCameraState(Number(options.camera))[variableId] === options.mode,
	}
}

/**
 * On/off settings, the id is the variable id.
 */
const OnOffSettings = [
	{ id: 'backlight', label: 'Backlight compensation' },
	{ id: 'wdr', label: 'Wide dynamic range' },
	{ id: 'exposure_compensation', label: 'Exposure compensation' },
]

/**
 * @param {FeedbackContext} self
 * @returns {import('@companion-module/base').CompanionFeedbackDefinitions}
 */
export function getFeedbackDefinitions(self) {
	/** @param {import('@companion-module/base').CompanionOptionValues} options */
	const stateOf = (options) => self.getCameraState(Number(options.camera))
	return {
		camera_selected: {
			type: 'boolean',
			name: 'Camera is selected',
			defaultStyle: activeStyle,
			options: [{ ...cameraOption, description: undefined, min: 1, default: 1 }],
			callback: ({ options }) => self.selectedCamera === Number(options.camera),
		},
		power_on: {
			type: 'boolean',
			name: 'Power is on',
			defaultStyle: activeStyle,
			options: [cameraOption],
			callback: ({ options }) => stateOf(options).power === 'On',
		},
		preset_active: {
			type: 'boolean',
			name: 'Preset was recalled last',
			description: 'Active after recalling or storing the preset, until the camera is moved manually',
			defaultStyle: activeStyle,
			options: [
				{ type: 'number', id: 'preset', label: 'Preset', min: 0, max: 127, default: 0, asInteger: true },
				cameraOption,
			],
			callback: ({ options }) => {
				const lastPreset = stateOf(options).last_preset
				return lastPreset !== '' && lastPreset === Number(options.preset)
			},
		},
		preset_stored: {
			type: 'boolean',
			name: 'Preset was just stored',
			description: 'Active for 1 s after the camera confirmed storing the preset',
			defaultStyle: { bgcolor: combineRgb(255, 204, 0), color: combineRgb(0, 0, 0) },
			options: [
				{ type: 'number', id: 'preset', label: 'Preset', min: 0, max: 127, default: 0, asInteger: true },
				cameraOption,
			],
			callback: ({ options }) => {
				const storedPreset = stateOf(options).stored_preset
				return storedPreset !== '' && storedPreset === Number(options.preset)
			},
		},
		focus_mode: modeFeedback(self, 'Focus mode', 'focus_mode', lut.focusModeArray),
		white_balance_mode: modeFeedback(self, 'White balance mode', 'white_balance_mode', lut.whiteBalanceModeArray),
		ae_mode: modeFeedback(self, 'AE mode', 'ae_mode', lut.aeModeArray),
		setting_on: {
			type: 'boolean',
			name: 'Setting is on',
			defaultStyle: activeStyle,
			options: [
				{
					type: 'dropdown',
					id: 'setting',
					label: 'Setting',
					choices: OnOffSettings,
					default: OnOffSettings[0].id,
				},
				cameraOption,
			],
			callback: ({ options }) => stateOf(options)[String(options.setting)] === 'On',
		},
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
	stored_preset: ['preset_stored'],
	focus_mode: ['focus_mode'],
	white_balance_mode: ['white_balance_mode'],
	ae_mode: ['ae_mode'],
	backlight: ['setting_on'],
	wdr: ['setting_on'],
	exposure_compensation: ['setting_on'],
}
