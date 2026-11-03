import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { InstanceBase, InstanceStatus, Regex } from '@companion-module/base'
import MarshallCamera, { Protocols } from '../visca/lib/Marshall/MarshallCamera.js'
import commands, { inquiries } from '../visca/lib/Marshall/commands.js'
import { getActionDefinitions } from './actions.js'
import { getModel, Models } from './models.js'
import { FeedbacksByVariable, getFeedbackDefinitions } from './feedbacks.js'
import { InquiryVariables, PolledInquiries, SpeedVariableDefinitions, VariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'

export { UpgradeScripts }

const RECONNECT_INTERVAL = 5000
const POLL_AFTER_COMMAND_DELAY = 300
const DEFAULT_SPEED = { pan: 12, tilt: 10, zoom: 4 }

const isTimeout = (reason) => reason instanceof Error && /Timeout|did not answer/.test(reason.message)
const reasonToMessage = (reason) =>
	reason instanceof Error ? reason.message : (reason?.packet?.name ?? String(reason))

export default class MarshallViscaInstance extends InstanceBase {
	async init(config) {
		this.config = config
		this.state = Object.fromEntries(Object.keys(VariableDefinitions).map((id) => [id, '']))
		this.speed = { ...DEFAULT_SPEED }
		this.model = getModel(config.model)

		this.setActionDefinitions(getActionDefinitions(this))
		this.setFeedbackDefinitions(getFeedbackDefinitions(this.state))
		this.setVariableDefinitions({ ...VariableDefinitions, ...SpeedVariableDefinitions })
		this.setVariableValues(this.state)
		this.setSpeed(this.speed)

		this.connect()
	}

	async destroy() {
		this.disconnect()
	}

	async configUpdated(config) {
		this.config = config
		const model = getModel(config.model)
		if (model !== this.model) {
			this.model = model
			this.setActionDefinitions(getActionDefinitions(this))
		}
		this.connect()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'Controls Marshall CV cameras with VISCA. Enable VISCA over IP in the network settings of the camera.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Camera IP or hostname',
				width: 8,
				regex: Regex.HOSTNAME,
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
				type: 'dropdown',
				id: 'protocol',
				label: 'Protocol',
				description:
					'VISCA over IP is the default of Marshall cameras. Raw VISCA sends one command at a time, use it only if the camera requires it.',
				width: 6,
				choices: [
					{ id: Protocols.VISCA_OVER_IP, label: 'VISCA over IP (UDP, default port 52381)' },
					{ id: Protocols.RAW_TCP, label: 'Raw VISCA over TCP' },
					{ id: Protocols.RAW_UDP, label: 'Raw VISCA over UDP' },
				],
				default: Protocols.VISCA_OVER_IP,
			},
			{
				type: 'dropdown',
				id: 'model',
				label: 'Model',
				description: 'Hides values the model does not support (e.g. UHD resolutions)',
				width: 6,
				choices: Models.map(({ id, label }) => ({ id, label })),
				default: Models[0].id,
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
		]
	}

	async connect() {
		this.disconnect()
		const generation = this.connectGeneration

		const host = String(this.config.host ?? '').trim()
		if (!host || !new RegExp(Regex.HOSTNAME.slice(1, -1)).test(host)) {
			this.updateStatus(InstanceStatus.BadConfig, 'Camera IP or hostname missing or invalid')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		// Replies are matched by IP address, so hostnames are resolved first
		let ip = host
		if (!net.isIPv4(host)) {
			try {
				ip = (await lookup(host, { family: 4 })).address
			} catch (error) {
				if (generation !== this.connectGeneration) return
				this.updateStatus(InstanceStatus.ConnectionFailure, `Cannot resolve ${host}: ${error.message}`)
				this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_INTERVAL)
				return
			}
			if (generation !== this.connectGeneration) return
		}

		const camera = new MarshallCamera(ip, {
			port: Number(this.config.port) || 52381,
			protocol: Object.values(Protocols).includes(this.config.protocol) ? this.config.protocol : undefined,
		})
		camera.on('error', (error) => this.log('debug', `VISCA: ${error.message}`))
		camera.connection.on('debug', (message) => this.log('debug', message))
		this.camera = camera
		this.polledInquiries = new Set(PolledInquiries)

		this.checkConnection()
	}

	disconnect() {
		// Invalidates a pending hostname lookup of connect()
		this.connectGeneration = (this.connectGeneration ?? 0) + 1
		clearTimeout(this.reconnectTimer)
		this.reconnectTimer = undefined
		this.stopPolling()
		if (this.camera) {
			this.camera.close()
			this.camera = undefined
		}
	}

	checkConnection() {
		const camera = this.camera
		clearTimeout(this.reconnectTimer)
		this.reconnectTimer = undefined
		this.stopPolling()

		camera.connect().then(
			() => {
				if (camera !== this.camera) return
				this.updateStatus(InstanceStatus.Ok)
				this.inquire('version')
				this.startPolling()
			},
			(error) => {
				if (camera !== this.camera) return
				this.connectionFailed(error.message)
			},
		)
	}

	connectionFailed(message) {
		if (this.reconnectTimer) return
		this.stopPolling()
		this.updateStatus(InstanceStatus.ConnectionFailure, message)
		this.reconnectTimer = setTimeout(() => this.checkConnection(), RECONNECT_INTERVAL)
	}

	startPolling() {
		this.stopPolling()
		const interval = Number(this.config.poll_interval) * 1000
		if (interval > 0) {
			this.pollTimer = setInterval(() => this.poll(), interval)
			this.poll()
		}
	}

	stopPolling() {
		clearInterval(this.pollTimer)
		clearTimeout(this.pollSoonTimer)
		this.pollTimer = undefined
		this.pollSoonTimer = undefined
	}

	/**
	 * Polls once shortly after a command, so that variables follow changes quickly.
	 */
	pollSoon() {
		if (!this.pollTimer) return
		clearTimeout(this.pollSoonTimer)
		this.pollSoonTimer = setTimeout(() => this.poll(), POLL_AFTER_COMMAND_DELAY)
	}

	async poll() {
		if (this.polling) return
		this.polling = true
		try {
			await Promise.all([...this.polledInquiries].map((key) => this.inquire(key)))
		} finally {
			this.polling = false
		}
	}

	async inquire(key) {
		const camera = this.camera
		if (!camera) return
		try {
			const answer = await camera.sendInquiry(inquiries[key]).answer
			if (camera !== this.camera) return
			this.updateState(InquiryVariables[key](answer))
			if (key === 'power') this.updateStatus(InstanceStatus.Ok)
		} catch (reason) {
			if (camera !== this.camera) return
			if (isTimeout(reason)) {
				// The power inquiry is the keepalive, other inquiries time out at the same time
				if (key === 'power') this.connectionFailed(reasonToMessage(reason))
			} else if (this.polledInquiries.delete(key)) {
				this.log(
					'debug',
					`Inquiry "${inquiries[key].name}" is not supported and no longer polled: ${reasonToMessage(reason)}`,
				)
			}
		}
	}

	setSpeed(speed) {
		this.speed = speed
		this.setVariableValues({ pan_speed: speed.pan, tilt_speed: speed.tilt, zoom_speed: speed.zoom })
	}

	updateState(values) {
		const changed = {}
		for (const [id, value] of Object.entries(values)) {
			if (value !== undefined && this.state[id] !== value) {
				this.state[id] = value
				changed[id] = value
			}
		}
		const ids = Object.keys(changed)
		if (!ids.length) return

		this.setVariableValues(changed)
		const feedbacks = new Set(ids.flatMap((id) => FeedbacksByVariable[id] ?? []))
		if (feedbacks.size) this.checkFeedbacks(...feedbacks)
	}

	sendCommand(command, parameterDict) {
		const camera = this.camera
		if (!camera) {
			this.log('warn', `Cannot send "${command.name}": camera is not configured`)
			return
		}

		let request
		try {
			request = camera.sendCommand(command, parameterDict)
		} catch (error) {
			this.log('error', `Cannot send "${command.name}": ${error.message}`)
			return
		}

		// Do not block the action on the completion, a preset recall can take several seconds
		request.completion.then(
			() => {
				if (camera !== this.camera) return
				this.updateStatus(InstanceStatus.Ok)
				if (command === commands['preset/recall']) {
					this.updateState({ last_preset: parameterDict['Preset'] })
				}
				this.pollSoon()
			},
			(reason) => {
				if (camera !== this.camera) return
				const message = reasonToMessage(reason)
				this.log('warn', `Command "${command.familyName ?? ''} ${command.name}" failed: ${message}`)
				if (isTimeout(reason)) {
					this.connectionFailed(message)
				}
			},
		)

		if (command.familyName === 'Pan Tilt' && command.name !== 'Stop') {
			this.updateState({ last_preset: '' })
		}
	}
}
