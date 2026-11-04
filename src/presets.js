// @ts-check
import { combineRgb } from '@companion-module/base'
import { MAX_CAMERAS } from './camera-option.js'

const white = combineRgb(255, 255, 255)
const black = combineRgb(0, 0, 0)
const green = combineRgb(0, 153, 0)
const yellow = combineRgb(255, 204, 0)

/**
 * @param {string} text
 * @param {import('@companion-module/base').CompanionTextSize} [size]
 * @returns {import('@companion-module/base').CompanionButtonStyleProps}
 */
const style = (text, size = '14') => ({ text, size, color: white, bgcolor: black })
/**
 * @param {string} actionId
 * @param {import('@companion-module/base').CompanionOptionValues} [options]
 */
const action = (actionId, options = {}) => ({ actionId, options })

/**
 * @returns {import('@companion-module/base').CompanionSimplePresetDefinition}
 */
const pressRelease = (name, text, down, up) => ({
	type: 'simple',
	name,
	style: style(text),
	steps: [{ down, up }],
	feedbacks: [],
})

/**
 * @param {string} name
 * @param {string} text
 * @param {any[]} actions
 * @param {any[]} [feedbacks]
 * @returns {import('@companion-module/base').CompanionSimplePresetDefinition}
 */
const press = (name, text, actions, feedbacks = []) => ({
	type: 'simple',
	name,
	style: style(text),
	steps: [{ down: actions, up: [] }],
	feedbacks,
})

const PAN_TILT_DIRECTIONS = [
	['Up', '↑'],
	['Down', '↓'],
	['Left', '←'],
	['Right', '→'],
	['Up Left', '↖'],
	['Up Right', '↗'],
	['Down Left', '↙'],
	['Down Right', '↘'],
]

const PRESET_NUMBERS = Array.from({ length: 16 }, (_, idx) => idx)
const PRESET_SAVE_HOLD_TIME = 2000

/**
 * Recalls the preset on a short press and stores it when held.
 * Companion runs the hold actions instead of the release actions, so a long press does not recall.
 *
 * @param {number} preset
 * @returns {import('@companion-module/base').CompanionSimplePresetDefinition}
 */
const presetButton = (preset) => ({
	type: 'simple',
	name: `Preset ${preset}`,
	style: style(`PRESET\n${preset}`),
	steps: [
		{
			down: [],
			up: [action('preset_recall', { preset })],
			[PRESET_SAVE_HOLD_TIME]: {
				// Stores while still held, so the user sees the result without releasing
				options: { runWhileHeld: true },
				actions: [action('preset_set', { preset })],
			},
		},
	],
	feedbacks: [
		{ feedbackId: 'preset_active', options: { preset }, style: { bgcolor: green } },
		// Last, so that the flash wins over green
		{ feedbackId: 'preset_stored', options: { preset }, style: { bgcolor: yellow, color: black } },
	],
	notes: `Short press: recall preset ${preset}. Hold ${PRESET_SAVE_HOLD_TIME / 1000} s: store the current position as preset ${preset}, the button flashes yellow when the camera confirmed it.`,
})

/**
 * @param {{ options: { id: string, default?: any }[] } | false | undefined} definition
 * @returns {Record<string, any>}
 */
const defaultOptions = (definition) =>
	Object.fromEntries(
		(definition ? definition.options : [])
			.filter((option) => option.default !== undefined)
			.map((option) => [option.id, option.default]),
	)

/**
 * Adds the default value of every option a preset does not set. Companion skips actions and
 * feedbacks with missing option values, e.g. the camera option.
 *
 * @param {import('@companion-module/base').CompanionPresetDefinitions} presets
 * @param {import('@companion-module/base').CompanionActionDefinitions} actions
 * @param {import('@companion-module/base').CompanionFeedbackDefinitions} feedbacks
 */
function fillDefaults(presets, actions, feedbacks) {
	for (const preset of Object.values(presets)) {
		if (!preset || preset.type !== 'simple') continue
		for (const step of preset.steps) {
			// Action sets are arrays (down, up) or { options, actions } for hold durations
			for (const set of Object.values(step)) {
				for (const entry of Array.isArray(set) ? set : (set?.actions ?? [])) {
					entry.options = { ...defaultOptions(actions[entry.actionId]), ...entry.options }
				}
			}
		}
		for (const entry of preset.feedbacks) {
			entry.options = { ...defaultOptions(feedbacks[entry.feedbackId]), ...entry.options }
		}
	}
}

/**
 * @param {string} label  Label of the connection, used to show variables on the buttons.
 * @param {{ number: number }[]} cameras  Configured cameras, their names are shown on the camera selection buttons
 * @param {object} definitions  Definitions the presets use, to fill in option defaults
 * @param {import('@companion-module/base').CompanionActionDefinitions} definitions.actions
 * @param {import('@companion-module/base').CompanionFeedbackDefinitions} definitions.feedbacks
 * @returns {{
 *   structure: import('@companion-module/base').CompanionPresetSection[],
 *   presets: import('@companion-module/base').CompanionPresetDefinitions,
 * }}
 */
export function getPresetDefinitions(label, cameras, { actions, feedbacks }) {
	/** @type {import('@companion-module/base').CompanionPresetDefinitions} */
	const presets = {}
	/** @type {import('@companion-module/base').CompanionPresetSection[]} */
	const structure = []
	const addSection = (id, name, description, definitions) => {
		for (const [presetId, preset] of Object.entries(definitions)) {
			presets[presetId] = preset
		}
		structure.push({ id, name, description, definitions: Object.keys(definitions) })
	}

	const configured = new Set(cameras.map(({ number }) => number))
	addSection(
		'camera_select',
		'Camera Selection',
		'Selects the camera that all other buttons control, green while selected. Configure the cameras in the connection settings.',
		{
			...Object.fromEntries(
				Array.from({ length: MAX_CAMERAS }, (_, idx) => idx + 1).map((number) => [
					`camera_select_${number}`,
					press(
						`Select Camera ${number}`,
						// The name variable only exists for configured cameras
						configured.has(number) ? `CAM ${number}\n$(${label}:cam${number}_name)` : `CAM ${number}`,
						[action('camera_select', { camera: number })],
						[{ feedbackId: 'camera_selected', options: { camera: number }, style: { bgcolor: green } }],
					),
				]),
			),
			camera_select_previous: press('Previous Camera', `◀ CAM\n$(${label}:selected_camera_name)`, [
				action('camera_select_previous'),
			]),
			camera_select_next: press('Next Camera', `CAM ▶\n$(${label}:selected_camera_name)`, [
				action('camera_select_next'),
			]),
		},
	)

	addSection(
		'pan_tilt',
		'Pan / Tilt',
		'Moves while the button is held, with the speed of the Speed buttons',
		Object.fromEntries([
			...PAN_TILT_DIRECTIONS.map(([direction, arrow]) => [
				`pan_tilt_${direction.toLowerCase().replace(' ', '_')}`,
				pressRelease(
					direction,
					`${arrow}\n${direction}`,
					[action('pan_tilt_move', { direction })],
					[action('pan_tilt_stop')],
				),
			]),
			['pan_tilt_home', press('Home', 'HOME', [action('pan_tilt_home')])],
		]),
	)

	addSection('zoom', 'Zoom', 'Zooms while the button is held, with the speed of the Speed buttons', {
		zoom_tele: pressRelease(
			'Zoom Tele',
			'ZOOM\nTELE',
			[action('zoom_move', { direction: 'tele' })],
			[action('zoom_move', { direction: 'stop' })],
		),
		zoom_wide: pressRelease(
			'Zoom Wide',
			'ZOOM\nWIDE',
			[action('zoom_move', { direction: 'wide' })],
			[action('zoom_move', { direction: 'stop' })],
		),
	})

	addSection('speed', 'Speed', 'Changes the speed used by the Pan / Tilt and Zoom buttons', {
		speed_up: press('Speed Up', `SPEED +\n$(${label}:pan_speed)`, [action('speed_increase', { axis: 'all', step: 1 })]),
		speed_down: press('Speed Down', `SPEED -\n$(${label}:pan_speed)`, [
			action('speed_decrease', { axis: 'all', step: 1 }),
		]),
	})

	addSection(
		'presets',
		'Presets',
		`Short press recalls the preset, holding for ${PRESET_SAVE_HOLD_TIME / 1000} s stores the current position. Green while it was the last recalled preset.`,
		Object.fromEntries(PRESET_NUMBERS.map((preset) => [`preset_${preset}`, presetButton(preset)])),
	)

	addSection('camera', 'Camera', undefined, {
		power_on: press(
			'Power On',
			'POWER\nON',
			[action('power', { power_mode: 'On' })],
			[{ feedbackId: 'power_on', options: {}, style: { bgcolor: green } }],
		),
		power_off: press('Power Off', 'POWER\nOFF', [action('power', { power_mode: 'Off (Standby)' })]),
	})

	addSection('focus', 'Focus', 'Near and far focus while the button is held, they only work in manual focus', {
		focus_near: {
			...pressRelease('Focus Near', 'FOCUS\nNEAR', [action('focus_near_standard')], [action('focus_stop')]),
			notes: 'Focuses nearer while held. Only works in manual focus.',
		},
		focus_far: {
			...pressRelease('Focus Far', 'FOCUS\nFAR', [action('focus_far_standard')], [action('focus_stop')]),
			notes: 'Focuses farther while held. Only works in manual focus.',
		},
		focus_auto: press(
			'Auto Focus',
			'AUTO\nFOCUS',
			[action('focus_mode', { focus_mode: 'Auto Focus' })],
			[{ feedbackId: 'focus_mode', options: { mode: 'Auto Focus' }, style: { bgcolor: green } }],
		),
		focus_manual: press(
			'Manual Focus',
			'MANUAL\nFOCUS',
			[action('focus_mode', { focus_mode: 'Manual Focus' })],
			[{ feedbackId: 'focus_mode', options: { mode: 'Manual Focus' }, style: { bgcolor: green } }],
		),
		focus_one_push: press('One Push Focus', 'ONE PUSH\nFOCUS', [action('focus_one_push_trigger')]),
	})

	const variable = (id) => `$(${label}:${id})`
	/**
	 * Mode buttons, green while the mode is active
	 *
	 * @param {string} prefix  Prefix of the preset ids
	 * @param {string} actionId
	 * @param {string} optionId
	 * @param {string} feedbackId
	 * @param {[string, string][]} modes  Mode and button text
	 */
	const modeButtons = (prefix, actionId, optionId, feedbackId, modes) =>
		Object.fromEntries(
			modes.map(([mode, text]) => [
				`${prefix}_${mode.toLowerCase().replace(/ /g, '_')}`,
				press(
					mode,
					text,
					[action(actionId, { [optionId]: mode })],
					[{ feedbackId, options: { mode }, style: { bgcolor: green } }],
				),
			]),
		)
	/**
	 * Up and down buttons that show the current value
	 *
	 * @param {string} id  Prefix of the preset ids
	 * @param {string} text  Button text
	 * @param {string} variableId  Variable with the current value
	 * @param {any[]} upActions
	 * @param {any[]} downActions
	 */
	const upDownButtons = (id, text, variableId, upActions, downActions) => ({
		[`${id}_up`]: press(`${text} +`, `${text} +\n${variable(variableId)}`, upActions),
		[`${id}_down`]: press(`${text} -`, `${text} -\n${variable(variableId)}`, downActions),
	})
	/**
	 * On and off buttons of a setting, green while it is on
	 *
	 * @param {string} id  Prefix of the preset ids, also the variable of the setting
	 * @param {string} text  Button text
	 * @param {string} actionId
	 * @param {boolean} [withFeedback]  Only for settings the camera reports (see the setting_on feedback)
	 */
	const onOffButtons = (id, text, actionId, withFeedback = true) => ({
		[`${id}_on`]: press(
			`${text} On`,
			`${text}\nON`,
			[action(actionId, { state: 'On' })],
			withFeedback ? [{ feedbackId: 'setting_on', options: { setting: id }, style: { bgcolor: green } }] : [],
		),
		[`${id}_off`]: press(`${text} Off`, `${text}\nOFF`, [action(actionId, { state: 'Off' })]),
	})

	addSection(
		'exposure',
		'Exposure / Iris',
		'AE mode and exposure values, each only works in the matching AE mode: iris in Manual/Iris Priority, shutter in Manual/Shutter Priority, gain in Manual, bright in Bright, exposure compensation and backlight in Auto.',
		{
			...modeButtons('ae_mode', 'exposure_mode', 'ae_mode', 'ae_mode', [
				['Full Auto', 'AE\nAUTO'],
				['Manual', 'AE\nMANUAL'],
				['Iris Priority', 'AE\nIRIS PRIO'],
				['Shutter Priority', 'AE\nSHUTTER PRIO'],
				['Bright', 'AE\nBRIGHT'],
			]),
			...upDownButtons('iris', 'IRIS', 'iris', [action('exposure_iris_up')], [action('exposure_iris_down')]),
			...upDownButtons(
				'shutter',
				'SHUTTER',
				'shutter_position',
				[action('exposure_shutter_up')],
				[action('exposure_shutter_down')],
			),
			...upDownButtons('gain', 'GAIN', 'gain_position', [action('exposure_gain_up')], [action('exposure_gain_down')]),
			...upDownButtons(
				'bright',
				'BRIGHT',
				'bright_position',
				[action('exposure_bright_up')],
				[action('exposure_bright_down')],
			),
			...onOffButtons('exposure_compensation', 'EXP COMP', 'exposure_compensation'),
			...upDownButtons(
				'exposure_compensation',
				'EXP COMP',
				'exposure_compensation_position',
				[action('exposure_compensation_up')],
				[action('exposure_compensation_down')],
			),
			...onOffButtons('backlight', 'BACKLIGHT', 'exposure_backlight'),
		},
	)

	/** AE modes in which the exposure buttons work (CV612 user manual) */
	const exposureNotes = {
		iris: 'Only works in AE mode Manual or Iris Priority.',
		shutter: 'Only works in AE mode Manual or Shutter Priority.',
		gain: 'Only works in AE mode Manual (on the CV612 also Shutter Priority).',
		bright: 'Only works in AE mode Bright.',
		exposure_compensation: 'Only works in AE mode Full Auto.',
		backlight: 'Only works in AE mode Full Auto.',
	}
	for (const [prefix, notes] of Object.entries(exposureNotes)) {
		for (const suffix of ['up', 'down', 'on', 'off']) {
			const preset = presets[`${prefix}_${suffix}`]
			if (preset?.type === 'simple') preset.notes = notes
		}
	}

	addSection(
		'color',
		'Color / White Balance',
		'White balance mode, red/blue gain (only in Manual mode), saturation and hue',
		{
			...modeButtons('white_balance', 'white_balance_mode', 'white_balance_mode', 'white_balance_mode', [
				['Auto', 'WB\nAUTO'],
				['Indoor', 'WB\nINDOOR'],
				['Outdoor', 'WB\nOUTDOOR'],
				['One Push', 'WB\nONE PUSH'],
				['Manual', 'WB\nMANUAL'],
			]),
			white_balance_one_push_trigger: press('One Push Trigger', 'WB\nTRIGGER', [
				action('white_balance_one_push_trigger'),
			]),
			...upDownButtons(
				'red_gain',
				'RED',
				'red_gain',
				[action('white_balance_red_gain_up')],
				[action('white_balance_red_gain_down')],
			),
			...upDownButtons(
				'blue_gain',
				'BLUE',
				'blue_gain',
				[action('white_balance_blue_gain_up')],
				[action('white_balance_blue_gain_down')],
			),
			...upDownButtons(
				'color_gain',
				'SAT',
				'saturation',
				[action('image_adjust', { setting: 'color_gain', step: 1 })],
				[action('image_adjust', { setting: 'color_gain', step: -1 })],
			),
			...upDownButtons(
				'hue',
				'HUE',
				'hue',
				[action('image_adjust', { setting: 'hue', step: 1 })],
				[action('image_adjust', { setting: 'hue', step: -1 })],
			),
		},
	)

	addSection('image', 'Image', undefined, {
		...upDownButtons(
			'aperture',
			'SHARPNESS',
			'aperture',
			[action('image_aperture_up')],
			[action('image_aperture_down')],
		),
		...onOffButtons('freeze', 'FREEZE', 'image_freeze', false),
	})

	fillDefaults(presets, actions, feedbacks)
	return { structure, presets }
}
