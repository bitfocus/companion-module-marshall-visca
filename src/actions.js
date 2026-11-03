import { Range, List } from '../visca/lib/Parameters.js'
import commands from '../visca/lib/Marshall/commands.js'

/**
 * Converts a command key like 'zoom/tele/variable' or a parameter name like 'Pan Speed'
 * into an id that is safe to use in Companion (and in expressions).
 */
export function toId(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '')
}

function createOption(parameter) {
	const option = {
		id: toId(parameter.name),
		label: parameter.name,
		tooltip: parameter.comment,
	}
	switch (true) {
		case parameter instanceof Range:
			return {
				...option,
				type: 'number',
				min: parameter.min,
				max: parameter.max,
				default: parameter.min,
				asInteger: true,
				clampValues: true,
			}
		case parameter instanceof List:
			return {
				...option,
				type: 'dropdown',
				choices: parameter.itemNameArray.map((itemName) => ({ id: itemName, label: itemName })),
				default: parameter.itemNameArray[0],
			}
		default:
			throw new Error(`Unsupported parameter type for ${parameter.name}`)
	}
}

/**
 * Converts the option values of an action back into the parameter dict of the command.
 */
export function toParameterDict(parameters, options) {
	const parameterDict = {}
	for (const parameter of parameters) {
		let value = options[toId(parameter.name)]
		if (parameter instanceof Range) {
			value = Math.round(Number(value))
		}
		parameterDict[parameter.name] = value
	}
	return parameterDict
}

/**
 * Creates the action definitions for all commands.
 *
 * @param {(command: object, parameterDict: object) => void} sendCommand
 */
export function getActionDefinitions(sendCommand) {
	const actions = {}

	for (const [key, command] of Object.entries(commands)) {
		// The address is set by the module, not by the user
		const parameters = [...command.pattern.getParameters()].filter((parameter) => parameter.name !== 'Address')

		actions[toId(key)] = {
			name: command.familyName ? `${command.familyName} - ${command.name}` : command.name,
			description: command.comment,
			options: parameters.map(createOption),
			callback: ({ options }) => sendCommand(command, toParameterDict(parameters, options)),
		}
	}

	return actions
}
