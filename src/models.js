// @ts-check
import { irisPositionArray } from '../visca/lib/Marshall/lookupTables.js'

/**
 * @typedef {object} Model
 * @property {string} id
 * @property {string} label
 * @property {boolean} uhd  Supports UHD resolutions
 * @property {string[]} [iris]  F-numbers by iris position, if they differ from the Marshall table of the CV620/CV630
 */

/** F-numbers of the CV612 by iris position, from the menu of the camera (user manual) */
const CV612_IRIS = [
	'Close',
	'F11',
	'F9.6',
	'F8.0',
	'F6.8',
	'F5.6',
	'F4.8',
	'F4.0',
	'F3.4',
	'F2.8',
	'F2.4',
	'F2.0',
	'F1.8',
]

const DEFAULT_IRIS_NAMES = new Map(Object.entries(irisPositionArray).map(([name, value]) => [value, name]))

/**
 * Supported models. The VISCA command set is shared, the models differ in the supported values.
 */
export const Models = [
	{ id: 'generic', label: 'Other / unknown (offer all values)', uhd: true },
	{ id: 'cv605', label: 'CV605 (5x, Full HD)', uhd: false },
	{ id: 'cv607', label: 'CV607 (7x, Full HD)', uhd: false },
	{ id: 'cv612', label: 'CV612 (12x, Full HD)', uhd: false, iris: CV612_IRIS },
	{ id: 'cv620', label: 'CV620 (20x, Full HD)', uhd: false },
	{ id: 'cv630', label: 'CV630 (30x, UHD30)', uhd: true },
	{ id: 'cv730', label: 'CV730 (30x, UHD60)', uhd: true },
]

/**
 * @param {unknown} id
 * @returns {Model}
 */
export function getModel(id) {
	return Models.find((model) => model.id === id) ?? Models[0]
}

/**
 * Model whose values are offered in actions that can control any of the cameras:
 * UHD values are only hidden when no camera supports them.
 *
 * @param {Model[]} models
 * @returns {Model}
 */
export function combineModels(models) {
	if (models.every((model) => model.id === models[0].id)) return models[0]
	// Different models: no model specific labels, UHD values only hidden when no camera supports them
	return { id: 'mixed', label: 'Mixed models', uhd: models.some((model) => model.uhd) }
}

/**
 * @param {Model} model
 * @param {number} position  Iris position of the camera
 * @returns {string}  F-number as shown by the camera
 */
export function irisLabel(model, position) {
	const name = model.iris ? model.iris[position] : DEFAULT_IRIS_NAMES.get(position)
	return name ?? `Unknown (${position})`
}

/**
 * Removes values from dropdowns that the model does not support.
 */
export function filterChoices(model, parameter, itemNames) {
	if (parameter.name === 'Resolution' && !model.uhd) {
		return itemNames.filter((itemName) => !itemName.startsWith('QFHD'))
	}
	const iris = model.iris
	if (parameter.name === 'Iris Position' && iris) {
		return itemNames.filter((itemName) => irisPositionArray[itemName] < iris.length)
	}
	return itemNames
}

/**
 * Label of a dropdown value. The ids stay the same for all models, so that actions keep working
 * when the model changes, the labels show the value of the model.
 *
 * @param {Model} model
 * @param {{ name: string }} parameter
 * @param {string} itemName
 * @returns {string}
 */
export function choiceLabel(model, parameter, itemName) {
	if (parameter.name === 'Iris Position' && model.iris) {
		return irisLabel(model, irisPositionArray[itemName])
	}
	return itemName
}
