import { combineRgb } from '@companion-module/base'

const white = combineRgb(255, 255, 255)
const black = combineRgb(0, 0, 0)
const green = combineRgb(0, 153, 0)

const style = (text, size = '14') => ({ text, size, color: white, bgcolor: black })
const action = (actionId, options = {}) => ({ actionId, options })

const pressRelease = (name, text, down, up) => ({
	type: 'simple',
	name,
	style: style(text),
	steps: [{ down, up }],
	feedbacks: [],
})

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

/**
 * @param {string} label  Label of the connection, used to show variables on the buttons.
 */
export function getPresetDefinitions(label) {
	const presets = {}
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
		'preset_recall',
		'Preset Recall',
		'Recalls a preset, green while it was the last recalled preset',
		Object.fromEntries(
			PRESET_NUMBERS.map((preset) => [
				`preset_recall_${preset}`,
				press(
					`Recall Preset ${preset}`,
					`PRESET\n${preset}`,
					[action('preset_recall', { preset })],
					[{ feedbackId: 'preset_active', options: { preset }, style: { bgcolor: green } }],
				),
			]),
		),
	)

	addSection(
		'preset_set',
		'Preset Set',
		'Stores the current position as preset',
		Object.fromEntries(
			PRESET_NUMBERS.map((preset) => [
				`preset_set_${preset}`,
				press(`Set Preset ${preset}`, `SET\n${preset}`, [action('preset_set', { preset })]),
			]),
		),
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
