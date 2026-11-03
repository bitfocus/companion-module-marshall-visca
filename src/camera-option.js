// @ts-check

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
	max: 8,
	default: 0,
	asInteger: true,
}
