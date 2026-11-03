/**
 * Supported models. The VISCA command set is shared, the models differ in the supported values.
 */
export const Models = [
	{ id: 'generic', label: 'Other / unknown (offer all values)', uhd: true },
	{ id: 'cv605', label: 'CV605 (5x, Full HD)', uhd: false },
	{ id: 'cv607', label: 'CV607 (7x, Full HD)', uhd: false },
	{ id: 'cv612', label: 'CV612 (12x, Full HD)', uhd: false },
	{ id: 'cv620', label: 'CV620 (20x, Full HD)', uhd: false },
	{ id: 'cv630', label: 'CV630 (30x, UHD30)', uhd: true },
	{ id: 'cv730', label: 'CV730 (30x, UHD60)', uhd: true },
]

export function getModel(id) {
	return Models.find((model) => model.id === id) ?? Models[0]
}

/**
 * Removes values from dropdowns that the model does not support.
 */
export function filterChoices(model, parameter, itemNames) {
	if (parameter.name === 'Resolution' && !model.uhd) {
		return itemNames.filter((itemName) => !itemName.startsWith('QFHD'))
	}
	return itemNames
}
