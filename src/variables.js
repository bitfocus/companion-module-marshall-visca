// @ts-check
export const VariableDefinitions = {
	power: { name: 'Power state' },
	zoom_position: { name: 'Zoom position' },
	focus_position: { name: 'Focus position' },
	focus_mode: { name: 'Focus mode' },
	white_balance_mode: { name: 'White balance mode' },
	ae_mode: { name: 'AE mode' },
	iris_position: { name: 'Iris position' },
	shutter_position: { name: 'Shutter position' },
	gain_position: { name: 'Gain position' },
	bright_position: { name: 'Bright position' },
	pan_position: { name: 'Pan position' },
	tilt_position: { name: 'Tilt position' },
	last_preset: { name: 'Last recalled or stored preset (empty after a manual move)' },
	vendor_id: { name: 'Vendor ID' },
	model_id: { name: 'Model ID' },
	rom_version: { name: 'ROM version' },
}

export const SpeedVariableDefinitions = {
	pan_speed: { name: 'Pan speed of the module speed actions' },
	tilt_speed: { name: 'Tilt speed of the module speed actions' },
	zoom_speed: { name: 'Zoom speed of the module speed actions' },
}

/**
 * Converts the answer of each inquiry into variable values.
 */
export const InquiryVariables = {
	power: (answer) => ({ power: answer['Power Mode'] }),
	zoomPosition: (answer) => ({ zoom_position: answer['Zoom Position'] }),
	focusPosition: (answer) => ({ focus_position: answer['Focus Position'] }),
	focusMode: (answer) => ({ focus_mode: answer['Focus Mode'] }),
	whiteBalanceMode: (answer) => ({ white_balance_mode: answer['White Balance Mode'] }),
	aeMode: (answer) => ({ ae_mode: answer['AE Mode'] }),
	irisPosition: (answer) => ({ iris_position: answer['Position'] }),
	shutterPosition: (answer) => ({ shutter_position: answer['Position'] }),
	gainPosition: (answer) => ({ gain_position: answer['Position'] }),
	brightPosition: (answer) => ({ bright_position: answer['Position'] }),
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
