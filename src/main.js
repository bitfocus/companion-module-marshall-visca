// @ts-check
import { InstanceBase, InstanceStatus, Regex } from '@companion-module/base'
import { Protocols } from '../visca/lib/Marshall/MarshallCamera.js'
import { getActionDefinitions } from './actions.js'
import { CameraConnection } from './camera-connection.js'
import { MAX_CAMERAS } from './camera-option.js'
import { getModel, Models, combineModels } from './models.js'
import { getPresetDefinitions } from './presets.js'
import { FeedbacksByVariable, getFeedbackDefinitions } from './feedbacks.js'
import { getVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'

export { UpgradeScripts }

const DEFAULT_SPEED = { pan: 12, tilt: 10, zoom: 4 }

/**
 * @typedef {{ pan: number, tilt: number, zoom: number }} Speed
 * @typedef {import('./camera-connection.js').CameraState} CameraState
 */

/**
 * Config field ids of a camera. Camera 1 keeps the ids of the single camera version.
 *
 * @param {number} number
 */
const cameraConfigIds = (number) =>
	number === 1
		? { name: 'name', host: 'host', model: 'model' }
		: { name: `name_${number}`, host: `host_${number}`, model: `model_${number}` }

export default class MarshallViscaInstance extends InstanceBase {
	/** @type {Record<string, any>} */
	config = {}
	/** @type {Speed} */
	speed = { ...DEFAULT_SPEED }
	/** @type {CameraConnection[]} Configured cameras */
	cameras = []
	/** Number of the camera that actions without explicit camera control */
	selectedCamera = 1
	/** @type {import('@companion-module/base').CompanionFeedbackDefinitions} */
	feedbackDefinitions = {}
	/** @type {import('./models.js').Model} Limits the values offered in actions */
	model = getModel(undefined)

	async init(config) {
		this.speed = { ...DEFAULT_SPEED }
		this.feedbackDefinitions = getFeedbackDefinitions(this)
		this.setFeedbackDefinitions(this.feedbackDefinitions)
		await this.configUpdated(config)
	}

	async destroy() {
		for (const camera of this.cameras) {
			camera.disconnect()
		}
		this.cameras = []
	}

	async configUpdated(config) {
		this.config = config
		await this.destroy()

		const count = Math.min(MAX_CAMERAS, Math.max(1, Math.round(Number(config.camera_count) || 1)))
		for (let number = 1; number <= count; number++) {
			const ids = cameraConfigIds(number)
			const host = String(config[ids.host] ?? '').trim()
			// Cameras without host are skipped, except camera 1 which reports the missing config
			if (!host && number > 1) continue
			this.cameras.push(
				new CameraConnection({
					number,
					name: String(config[ids.name] ?? '').trim() || `Camera ${number}`,
					host,
					model: getModel(config[ids.model]),
					port: Number(config.port) || 52381,
					protocol: config.protocol,
					pollInterval: Number(config.poll_interval ?? 2) * 1000,
					log: (level, message) => this.log(level, message),
					onStatus: () => this.updateCombinedStatus(),
					onStateChange: (camera, changed) => this.cameraStateChanged(camera, changed),
				}),
			)
		}
		if (!this.getCamera(this.selectedCamera)) {
			this.selectedCamera = this.cameras[0].number
		}

		this.model = combineModels(this.cameras.map((camera) => camera.model))
		const actionDefinitions = getActionDefinitions(this)
		this.setActionDefinitions(actionDefinitions)
		this.setVariableDefinitions(getVariableDefinitions(this.cameras.map((camera) => camera.number)))
		const { structure, presets } = getPresetDefinitions(this.label, this.cameras, {
			actions: actionDefinitions,
			feedbacks: this.feedbackDefinitions,
		})
		this.setPresetDefinitions(structure, presets)

		this.setSpeed(this.speed)
		this.setVariableValues(
			Object.fromEntries(
				this.cameras.flatMap((camera) => [
					[`cam${camera.number}_name`, camera.name],
					...Object.entries(camera.state).map(([id, value]) => [`cam${camera.number}_${id}`, value]),
				]),
			),
		)
		this.selectCamera(this.selectedCamera)

		for (const camera of this.cameras) {
			camera.connect()
		}
	}

	/**
	 * @returns {import('@companion-module/base').SomeCompanionConfigField[]}
	 */
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Controls one or more Marshall CV cameras with VISCA. Enable VISCA over IP in the network settings of the cameras. Actions control the selected camera unless a camera number is set in the action.',
			},
			{
				type: 'number',
				id: 'camera_count',
				label: 'Number of cameras',
				width: 4,
				min: 1,
				max: MAX_CAMERAS,
				default: 1,
				asInteger: true,
			},
			{
				type: 'number',
				id: 'port',
				label: 'VISCA Port',
				width: 4,
				min: 1,
				max: 65535,
				default: 52381,
				asInteger: true,
			},
			{
				type: 'number',
				id: 'poll_interval',
				label: 'Status polling interval (s)',
				description: 'Updates variables and feedbacks and checks the connection. 0 disables polling.',
				width: 4,
				min: 0,
				max: 60,
				default: 2,
				step: 0.5,
			},
			{
				type: 'dropdown',
				id: 'protocol',
				label: 'Protocol',
				description:
					'VISCA over IP is the default of Marshall cameras. Raw VISCA sends one command at a time, use it only if the cameras require it.',
				width: 12,
				choices: [
					{ id: Protocols.VISCA_OVER_IP, label: 'VISCA over IP (UDP, default port 52381)' },
					{ id: Protocols.RAW_TCP, label: 'Raw VISCA over TCP' },
					{ id: Protocols.RAW_UDP, label: 'Raw VISCA over UDP' },
				],
				default: Protocols.VISCA_OVER_IP,
			},
			...Array.from({ length: MAX_CAMERAS }, (_, idx) => idx + 1).flatMap((number) => {
				const ids = cameraConfigIds(number)
				const isVisibleExpression = number > 1 ? `$(options:camera_count) >= ${number}` : undefined
				/** @type {import('@companion-module/base').SomeCompanionConfigField[]} */
				const fields = [
					{
						type: 'textinput',
						id: ids.name,
						label: `Camera ${number} name`,
						width: 3,
						default: `Camera ${number}`,
						isVisibleExpression,
					},
					{
						type: 'textinput',
						id: ids.host,
						label: `Camera ${number} IP or hostname`,
						width: 4,
						regex: Regex.HOSTNAME,
						isVisibleExpression,
					},
					{
						type: 'dropdown',
						id: ids.model,
						label: `Camera ${number} model`,
						description: number === 1 ? 'Hides values the model does not support (e.g. UHD resolutions)' : undefined,
						width: 5,
						choices: Models.map(({ id, label }) => ({ id, label })),
						default: Models[0].id,
						isVisibleExpression,
					},
				]
				return fields
			}),
		]
	}

	/**
	 * @param {number | undefined} number  Camera number, 0 or invalid for the selected camera
	 * @returns {CameraConnection | undefined}
	 */
	getCamera(number) {
		const wanted = Math.round(Number(number)) > 0 ? Math.round(Number(number)) : this.selectedCamera
		return this.cameras.find((camera) => camera.number === wanted)
	}

	/**
	 * @param {number | undefined} number  Camera number, 0 for the selected camera
	 * @returns {CameraState}
	 */
	getCameraState(number) {
		return this.getCamera(number)?.state ?? {}
	}

	/**
	 * @param {number | undefined} number  Camera number, 0 for the selected camera
	 * @param {Record<string, any>} values
	 */
	updateCameraState(number, values) {
		this.getCamera(number)?.updateState(values)
	}

	/**
	 * Selects the camera that actions control when they do not set a camera.
	 *
	 * @param {number} number
	 * @returns {boolean}  Whether the camera exists
	 */
	selectCamera(number) {
		const camera = this.cameras.find((camera) => camera.number === Math.round(Number(number)))
		if (!camera) {
			this.log('warn', `Camera ${number} is not configured`)
			return false
		}
		this.selectedCamera = camera.number
		this.setVariableValues({ selected_camera: camera.number, selected_camera_name: camera.name, ...camera.state })
		this.checkAllFeedbacks()
		return true
	}

	/**
	 * @param {number} offset  +1 for the next camera, -1 for the previous one, wraps around
	 */
	selectCameraByOffset(offset) {
		const idx = this.cameras.findIndex((camera) => camera.number === this.selectedCamera)
		const next = this.cameras[(idx + offset + this.cameras.length * 2) % this.cameras.length]
		this.selectCamera(next.number)
	}

	/**
	 * @param {any} command  Command of the VISCA library
	 * @param {Record<string, any>} parameterDict
	 * @param {number} [cameraNumber]  0 or undefined for the selected camera
	 */
	sendCommand(command, parameterDict, cameraNumber) {
		const camera = this.getCamera(cameraNumber)
		if (!camera) {
			this.log('warn', `Cannot send "${command.name}": camera ${cameraNumber} is not configured`)
			return
		}
		camera.sendCommand(command, parameterDict)
	}

	/**
	 * @param {Speed} speed
	 */
	setSpeed(speed) {
		this.speed = speed
		this.setVariableValues({ pan_speed: speed.pan, tilt_speed: speed.tilt, zoom_speed: speed.zoom })
	}

	/**
	 * @param {CameraConnection} camera
	 * @param {CameraState} changed
	 */
	cameraStateChanged(camera, changed) {
		/** @type {CameraState} */
		const values = Object.fromEntries(
			Object.entries(changed).map(([id, value]) => [`cam${camera.number}_${id}`, value]),
		)
		if (camera.number === this.selectedCamera) {
			Object.assign(values, changed)
		}
		this.setVariableValues(values)

		const feedbacks = new Set(Object.keys(changed).flatMap((id) => FeedbacksByVariable[id] ?? []))
		const [first, ...rest] = feedbacks
		if (first) this.checkFeedbacks(first, ...rest)
	}

	/**
	 * Combines the status of all cameras into the status of the connection.
	 */
	updateCombinedStatus() {
		const failed = this.cameras.filter((camera) =>
			[InstanceStatus.ConnectionFailure, InstanceStatus.BadConfig].includes(camera.status),
		)
		const message = failed.map((camera) => `${camera.label}: ${camera.statusMessage}`).join(', ') || null

		if (this.cameras.length === 1) {
			const [camera] = this.cameras
			this.updateStatus(camera.status, camera.statusMessage)
		} else if (failed.length === this.cameras.length) {
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
		} else if (failed.length) {
			this.updateStatus(InstanceStatus.UnknownWarning, message)
		} else if (this.cameras.some((camera) => camera.status === InstanceStatus.Connecting)) {
			this.updateStatus(InstanceStatus.Connecting)
		} else {
			this.updateStatus(InstanceStatus.Ok)
		}
	}
}
