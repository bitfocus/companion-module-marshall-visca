// @ts-check

/** Number of cameras one connection can control */
export const MAX_CAMERAS = 8

/**
 * Option of actions and feedbacks that chooses the camera. Being a number, it can be an expression,
 * e.g. a variable that holds the camera number.
 *
 * @type {import('@companion-module/base').CompanionInputFieldNumber}
 */
export const cameraOption = {
	type: 'number',
	id: 'camera',
	label: 'Camera',
	description: '0 controls the selected camera',
	min: 0,
	max: MAX_CAMERAS,
	default: 0,
	asInteger: true,
}
