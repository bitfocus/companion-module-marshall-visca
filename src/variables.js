// @ts-check
import { irisLabel } from './models.js'

/** Hue position of the neutral hue: positions 0 to 30 are shown as -15 to +15 */
export const HUE_OFFSET = 15

/**
 * @param {number} level  Color gain position, 0 is 60 %, every step 10 %
 */
export const saturationVariables = (level) => ({ color_gain: level, saturation: `${60 + level * 10}%` })

/**
 * @param {number} position  Hue position, 0 to 30
 */
export const hueVariables = (position) => ({ hue: position - HUE_OFFSET })
export const VariableDefinitions = {
	power: { name: 'Power state' },
	zoom_position: { name: 'Zoom position' },
	focus_position: { name: 'Focus position' },
	focus_mode: { name: 'Focus mode' },
	white_balance_mode: { name: 'White balance mode' },
	ae_mode: { name: 'AE mode' },
	iris_position: { name: 'Iris position' },
	iris: { name: 'Iris (F-number)' },
	shutter_position: { name: 'Shutter position' },
	gain_position: { name: 'Gain position' },
	bright_position: { name: 'Bright position' },
	exposure_compensation: { name: 'Exposure compensation (On/Off)' },
	exposure_compensation_position: { name: 'Exposure compensation position (7 is neutral)' },
	backlight: { name: 'Backlight compensation (On/Off)' },
	wdr: { name: 'Wide dynamic range (On/Off)' },
	red_gain: { name: 'White balance red gain' },
	blue_gain: { name: 'White balance blue gain' },
	saturation: { name: 'Saturation (60 to 200 %)' },
	color_gain: { name: 'Saturation position (0 = 60 %, 4 = 100 %, 14 = 200 %)' },
	hue: { name: 'Hue (-15 to +15, 0 is neutral)' },
	aperture: { name: 'Aperture (sharpness)' },
	pan_position: { name: 'Pan position' },
	tilt_position: { name: 'Tilt position' },
	last_preset: { name: 'Last recalled or stored preset (empty after a manual move)' },
	stored_preset: { name: 'Preset that was just stored (empty again after 1 s)' },
	vendor_id: { name: 'Vendor ID' },
	model_id: { name: 'Model ID' },
	rom_version: { name: 'ROM version' },
}

/**
 * Variables of the connection: the values of the selected camera without prefix,
 * the values of each camera with the prefix cam<number>_.
 *
 * @param {number[]} cameraNumbers
 * @returns {Record<string, { name: string }>}
 */
export function getVariableDefinitions(cameraNumbers) {
	return {
		selected_camera: { name: 'Number of the selected camera' },
		selected_camera_name: { name: 'Name of the selected camera' },
		...Object.fromEntries(
			Object.entries(VariableDefinitions).map(([id, { name }]) => [id, { name: `${name} (selected camera)` }]),
		),
		...SpeedVariableDefinitions,
		...Object.fromEntries(
			cameraNumbers.flatMap((number) => [
				[`cam${number}_name`, { name: `Camera ${number}: name` }],
				...Object.entries(VariableDefinitions).map(([id, { name }]) => [
					`cam${number}_${id}`,
					{ name: `Camera ${number}: ${name}` },
				]),
			]),
		),
	}
}

export const SpeedVariableDefinitions = {
	pan_speed: { name: 'Pan speed of the module speed actions' },
	tilt_speed: { name: 'Tilt speed of the module speed actions' },
	zoom_speed: { name: 'Zoom speed of the module speed actions' },
}

/**
 * Converts the answer of each inquiry into variable values.
 *
 * @type {Record<string, (answer: Record<string, any>, model: import('./models.js').Model) => Record<string, any>>}
 */
export const InquiryVariables = {
	power: (answer) => ({ power: answer['Power Mode'] }),
	zoomPosition: (answer) => ({ zoom_position: answer['Zoom Position'] }),
	focusPosition: (answer) => ({ focus_position: answer['Focus Position'] }),
	focusMode: (answer) => ({ focus_mode: answer['Focus Mode'] }),
	whiteBalanceMode: (answer) => ({ white_balance_mode: answer['White Balance Mode'] }),
	aeMode: (answer) => ({ ae_mode: answer['AE Mode'] }),
	irisPosition: (answer, model) => ({
		iris_position: answer['Position'],
		iris: irisLabel(model, answer['Position']),
	}),
	shutterPosition: (answer) => ({ shutter_position: answer['Position'] }),
	gainPosition: (answer) => ({ gain_position: answer['Position'] }),
	brightPosition: (answer) => ({ bright_position: answer['Position'] }),
	exposureCompensation: (answer) => ({ exposure_compensation: answer['State'] }),
	exposureCompensationPosition: (answer) => ({ exposure_compensation_position: answer['Position'] }),
	backlight: (answer) => ({ backlight: answer['State'] }),
	wdr: (answer) => ({ wdr: answer['State'] }),
	redGain: (answer) => ({ red_gain: answer['Position'] }),
	blueGain: (answer) => ({ blue_gain: answer['Position'] }),
	colorGain: (answer) => saturationVariables(answer['Level']),
	hue: (answer) => hueVariables(answer['Position']),
	aperture: (answer) => ({ aperture: answer['Position'] }),
	panTiltPosition: (answer) => ({ pan_position: answer['Pan Position'], tilt_position: answer['Tilt Position'] }),
	version: (answer) => ({
		vendor_id: answer['Vendor ID'],
		model_id: answer['Model ID'],
		rom_version: answer['ROM Version'],
	}),
}

/**
 * Inquiries that are polled regularly, the version is only queried once after connecting.
 */
export const PolledInquiries = Object.keys(InquiryVariables).filter((key) => key !== 'version')
