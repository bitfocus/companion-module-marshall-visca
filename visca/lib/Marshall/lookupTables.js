export const nSockets = 2

export const irisPositionArray = {
	Close: 0x0f,
	'F1.6': 0x0e,
	F2: 0x0d,
	'F2.2': 0x0c,
	'F2.7': 0x0b,
	'F3.2': 0x0a,
	'F3.8': 0x09,
	'F4.5': 0x08,
	'F5.4': 0x07,
	'F6.3': 0x06,
	'F7.8': 0x05,
	F9: 0x04,
	F11: 0x03,
	F13: 0x02,
	F16: 0x01,
	F18: 0x00,
}

export const powerModeArray = {
	On: 0x02,
	'Off (Standby)': 0x03,
}

export const defaultOnOffArray = {
	On: 0x02,
	Off: 0x03,
}

export const focusModeArray = {
	'Auto Focus': 0x02,
	'Manual Focus': 0x03,
}

export const curveTrackingArray = {
	'Curve tracking': 0x02,
	'Zoom tracking': 0x03,
}

export const autofocusSensitivityArray = {
	High: 0x01,
	Middle: 0x02,
	Low: 0x03,
}

export const autofocusFrameArray = {
	Auto: 0x01,
	'Full Frame': 0x02,
	Center: 0x03,
}

export const resolutionArray = {
	'QFHD 4K(3840 x 2160) - 29.97p': 0x05,
	'QFHD 4K(3840 x 2160) - 25p': 0x06,
	'FHD 1080P(1920 x 1080) - 59.94p': 0x08,
	'FHD 1080P(1920 x 1080) - 50p': 0x09,
	'FHD 1080P(1920 x 1080) - 29.97p': 0x0b,
	'FHD 1080P(1920 x 1080) - 25p': 0x0c,
	'HD 720P(1280 x 720) - 59.94p': 0x0e,
	'HD 720P(1280 x 720) - 50p': 0x0f,
	'HD 720P(1280 x 720) - 29.97p': 0x11,
	'HD 720P(1280 x 720) - 25p': 0x12,
}

export const hdmiOutputRangeArray = {
	'16~235': 0x01,
	'1~254': 0x02,
}

export const whiteBalanceModeArray = {
	Auto: 0x00,
	Indoor: 0x01,
	Outdoor: 0x02,
	'One Push': 0x03,
	'Auto Tracing': 0x04,
	Manual: 0x05,
	'Sodium Lamp': 0x0c,
}
export const panTiltDirectionArray = {
	Up: 0x31,
	Down: 0x32,
	Left: 0x13,
	Right: 0x23,
	'Up Left': 0x11,
	'Up Right': 0x21,
	'Down Left': 0x12,
	'Down Right': 0x22,
	Stop: 0x33,
}

export const aeModeArray = {
	'Full Auto': 0x00,
	Manual: 0x03,
	'Shutter Priority': 0x0a,
	'Iris Priority': 0x0b,
	Bright: 0x0d,
}

export const panTiltLimitCornerArray = {
	'Down Left': 0x00,
	'Up Right': 0x01,
}
