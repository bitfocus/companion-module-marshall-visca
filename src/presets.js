// @ts-check
import { combineRgb } from '@companion-module/base'

const white = combineRgb(255, 255, 255)
const black = combineRgb(0, 0, 0)
const green = combineRgb(0, 153, 0)

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
	feedbacks: [{ feedbackId: 'preset_active', options: { preset }, style: { bgcolor: green } }],
	notes: `Short press: recall preset ${preset}. Hold ${PRESET_SAVE_HOLD_TIME / 1000} s: store the current position as preset ${preset}.`,
})

/**
 * @param {string} label  Label of the connection, used to show variables on the buttons.
 * @returns {{
 *   structure: import('@companion-module/base').CompanionPresetSection[],
 *   presets: import('@companion-module/base').CompanionPresetDefinitions,
 * }}
 */
export function getPresetDefinitions(label) {
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

	return { structure, presets }
}
