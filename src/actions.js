// @ts-check
import { Range, List } from '../visca/lib/Parameters.js'
import commands, { createCustomCommand } from '../visca/lib/Marshall/commands.js'
import * as par from '../visca/lib/Marshall/parameters.js'
import { filterChoices } from './models.js'

/**
 * @typedef {import('@companion-module/base').CompanionActionDefinitions} ActionDefinitions
 * @typedef {import('@companion-module/base').SomeCompanionActionInputField} ActionInputField
 *
 * @typedef {object} ActionContext  The module instance, or a stub in tests
 * @property {(command: any, parameterDict: Record<string, any>) => void} sendCommand
 * @property {import('./models.js').Model} [model]  Limits the offered values
 * @property {import('./main.js').Speed} speed  Speed of the module speed actions
 * @property {(speed: import('./main.js').Speed) => void} setSpeed
 * @property {(level: import('@companion-module/base').LogLevel, message: string) => void} log
 * @property {Record<string, unknown>} state  Current variable values, from polling
 * @property {(values: Record<string, any>) => void} updateState
 */

/**
 * Converts a command key like 'zoom/tele/variable' or a parameter name like 'Pan Speed'
 * into an id that is safe to use in Companion (and in expressions).
 */
/**
 * @param {string} name
 * @returns {string}
 */
export function toId(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '')
}

/**
 * @param {any} parameter  Parameter of the VISCA library
 * @param {import('./models.js').Model} [model]
 * @returns {ActionInputField}
 */
function createOption(parameter, model) {
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
				default: Math.min(Math.max(0, parameter.min), parameter.max),
				asInteger: true,
				clampValues: true,
			}
		case parameter instanceof List: {
			const itemNames = model ? filterChoices(model, parameter, parameter.itemNameArray) : parameter.itemNameArray
			return {
				...option,
				type: 'dropdown',
				choices: itemNames.map((itemName) => ({ id: itemName, label: itemName })),
				default: itemNames[0],
			}
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
 * @param {Pick<ActionContext, 'sendCommand' | 'model'>} self
 * @returns {ActionDefinitions}
 */
export function getCommandActionDefinitions(self) {
	const actions = {}

	for (const [key, command] of Object.entries(commands)) {
		// The address is set by the module, not by the user
		const parameters = [...command.pattern.getParameters()].filter((parameter) => parameter.name !== 'Address')

		actions[toId(key)] = {
			name: command.familyName ? `${command.familyName} - ${command.name}` : command.name,
			description: command.comment,
			options: parameters.map((parameter) => createOption(parameter, self.model)),
			callback: ({ options }) => self.sendCommand(command, toParameterDict(parameters, options)),
		}
	}

	return actions
}

/**
 * @param {{ min: number, max: number }} parameter
 * @param {unknown} value
 */
const clamp = (parameter, value) => Math.min(parameter.max, Math.max(parameter.min, Math.round(Number(value))))

/**
 * Settings without up/down command, adjusted with the direct command. The key is the variable id.
 */
const AdjustableSettings = {
	color_gain: { label: 'Color Gain', command: 'image/colorGain', parameter: par.colorGain },
	hue: { label: 'Hue', command: 'image/hue', parameter: par.hue },
}

const speedOptions = [par.panSpeed, par.tiltSpeed, par.zoomAndFocusSpeed].map((parameter) => createOption(parameter))
const directionOption = createOption(par.panTiltDirection)

/**
 * Actions that use the speed stored in the module, so that buttons (e.g. speed up/down) can change it.
 *
 * @param {ActionContext} self
 * @returns {ActionDefinitions}
 */
export function getModuleActionDefinitions(self) {
	const changeSpeed =
		(sign) =>
		({ options }) => {
			const step = sign * Number(options.step)
			const speed = { ...self.speed }
			if (options.axis !== 'zoom') {
				speed.pan = clamp(par.panSpeed, speed.pan + step)
				speed.tilt = clamp(par.tiltSpeed, speed.tilt + step)
			}
			if (options.axis !== 'pan_tilt') {
				speed.zoom = clamp(par.zoomAndFocusSpeed, speed.zoom + step)
			}
			self.setSpeed(speed)
		}
	/** @type {ActionInputField[]} */
	const changeSpeedOptions = [
		{
			type: 'dropdown',
			id: 'axis',
			label: 'Speed',
			choices: [
				{ id: 'all', label: 'Pan/Tilt and Zoom' },
				{ id: 'pan_tilt', label: 'Pan/Tilt' },
				{ id: 'zoom', label: 'Zoom' },
			],
			default: 'all',
		},
		{ type: 'number', id: 'step', label: 'Step', min: 1, max: 10, default: 1, asInteger: true },
	]

	return {
		speed_set: {
			name: 'Speed - Set',
			description: 'Sets the speed used by "Pan Tilt - Move" and "Zoom - Move"',
			options: speedOptions,
			callback: ({ options }) =>
				self.setSpeed({
					pan: clamp(par.panSpeed, options.pan_speed),
					tilt: clamp(par.tiltSpeed, options.tilt_speed),
					zoom: clamp(par.zoomAndFocusSpeed, options.speed),
				}),
		},
		speed_increase: { name: 'Speed - Increase', options: changeSpeedOptions, callback: changeSpeed(1) },
		speed_decrease: { name: 'Speed - Decrease', options: changeSpeedOptions, callback: changeSpeed(-1) },
		pan_tilt_move: {
			name: 'Pan Tilt - Move (Module Speed)',
			description: 'Drives with the speed set by the speed actions, use Stop on release',
			options: [directionOption],
			callback: ({ options }) =>
				self.sendCommand(commands['panTilt/drive'], {
					'Pan Speed': self.speed.pan,
					'Tilt Speed': self.speed.tilt,
					Direction: options.direction,
				}),
		},
		zoom_move: {
			name: 'Zoom - Move (Module Speed)',
			description: 'Zooms with the speed set by the speed actions, use Stop on release',
			options: [
				{
					type: 'dropdown',
					id: 'direction',
					label: 'Direction',
					choices: [
						{ id: 'tele', label: 'Tele' },
						{ id: 'wide', label: 'Wide' },
						{ id: 'stop', label: 'Stop' },
					],
					default: 'tele',
				},
			],
			callback: ({ options }) => {
				if (options.direction === 'stop') {
					self.sendCommand(commands['zoom/stop'], {})
				} else {
					self.sendCommand(commands[`zoom/${options.direction === 'wide' ? 'wide' : 'tele'}/variable`], {
						Speed: self.speed.zoom,
					})
				}
			},
		},
		image_adjust: {
			name: 'Image - Adjust Color Gain / Hue',
			description: 'Steps the value up or down, based on the polled current value',
			options: [
				{
					type: 'dropdown',
					id: 'setting',
					label: 'Setting',
					choices: Object.entries(AdjustableSettings).map(([id, { label }]) => ({ id, label })),
					default: 'color_gain',
				},
				{
					type: 'number',
					id: 'step',
					label: 'Step (negative to decrease)',
					min: -14,
					max: 14,
					default: 1,
					asInteger: true,
				},
			],
			callback: ({ options }) => {
				const setting = AdjustableSettings[String(options.setting)]
				if (!setting) return
				const current = self.state[String(options.setting)]
				if (typeof current !== 'number') {
					self.log('warn', `${setting.label} is unknown, it needs status polling and a camera that reports it`)
					return
				}
				const value = clamp(setting.parameter, current + Number(options.step))
				self.sendCommand(commands[setting.command], { [setting.parameter.name]: value })
				// Repeated presses build on the new value before the next poll
				self.updateState({ [String(options.setting)]: value })
			},
		},
		custom_command: {
			name: 'Custom VISCA Command',
			description: 'Sends any VISCA command, e.g. 81 01 04 07 02 FF',
			options: [{ type: 'textinput', id: 'command', label: 'Command (hex)', default: '81 01 04 07 00 FF' }],
			callback: ({ options }) => {
				let command
				try {
					command = createCustomCommand(String(options.command))
				} catch (error) {
					self.log('warn', `Invalid custom command "${options.command}": ${error.message}`)
					return
				}
				self.sendCommand(command, {})
			},
		},
	}
}

/**
 * @param {ActionContext} self
 * @returns {ActionDefinitions}
 */
export function getActionDefinitions(self) {
	return { ...getCommandActionDefinitions(self), ...getModuleActionDefinitions(self) }
}
