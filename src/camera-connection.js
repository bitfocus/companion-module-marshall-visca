// @ts-check
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { InstanceStatus, Regex } from '@companion-module/base'
import MarshallCamera, { Protocols } from '../visca/lib/Marshall/MarshallCamera.js'
import commands, { inquiries } from '../visca/lib/Marshall/commands.js'
import { InquiryVariables, PolledInquiries, VariableDefinitions } from './variables.js'

const RECONNECT_INTERVAL = 5000
const POLL_AFTER_COMMAND_DELAY = 300

const isTimeout = (reason) => reason instanceof Error && /Timeout|did not answer/.test(reason.message)
const isUnsupported = (reason) => /^Syntax Error/.test(reason?.packet?.name ?? '')
const reasonToMessage = (reason) =>
	reason instanceof Error ? reason.message : (reason?.packet?.name ?? String(reason))

/**
 * @typedef {Record<string, import('@companion-module/base').JsonValue>} CameraState  Variable values of a camera
 *
 * @typedef {object} CameraConnectionOptions
 * @property {number} number  Number of the camera, starting at 1
 * @property {string} name
 * @property {string} host
 * @property {import('./models.js').Model} model
 * @property {number} port
 * @property {string} [protocol]  One of Protocols
 * @property {number} pollInterval  Status polling interval in ms, 0 disables polling
 * @property {(level: import('@companion-module/base').LogLevel, message: string) => void} log
 * @property {(connection: CameraConnection) => void} onStatus  Called when the status changes
 * @property {(connection: CameraConnection, changed: CameraState) => void} onStateChange
 */

/**
 * Connection to one camera: connects, polls the status and sends commands.
 */
export class CameraConnection {
	/** @type {CameraState} */
	state = Object.fromEntries(Object.keys(VariableDefinitions).map((id) => [id, '']))
	/** @type {InstanceStatus} */
	status = InstanceStatus.Connecting
	/** @type {string | null} */
	statusMessage = null
	/** @type {MarshallCamera | undefined} */
	camera = undefined
	/** @type {Set<string>} Inquiries that the camera supports */
	polledInquiries = new Set()
	/** @type {NodeJS.Timeout | undefined} */
	reconnectTimer = undefined
	/** @type {NodeJS.Timeout | undefined} */
	pollTimer = undefined
	/** @type {NodeJS.Timeout | undefined} */
	pollSoonTimer = undefined
	polling = false
	connectGeneration = 0

	/**
	 * @param {CameraConnectionOptions} options
	 */
	constructor(options) {
		this.options = options
		this.number = options.number
		this.name = options.name
		this.model = options.model
	}

	get label() {
		return `Camera ${this.number} (${this.name})`
	}

	/**
	 * @param {import('@companion-module/base').LogLevel} level
	 * @param {string} message
	 */
	log(level, message) {
		this.options.log(level, `${this.label}: ${message}`)
	}

	/**
	 * @param {InstanceStatus} status
	 * @param {string | null} [message]
	 */
	setStatus(status, message = null) {
		if (status === this.status && message === this.statusMessage) return
		this.status = status
		this.statusMessage = message
		this.options.onStatus(this)
	}

	async connect() {
		this.disconnect()
		const generation = this.connectGeneration

		const host = this.options.host.trim()
		if (!host || !new RegExp(Regex.HOSTNAME.slice(1, -1)).test(host)) {
			this.setStatus(InstanceStatus.BadConfig, 'IP or hostname missing or invalid')
			return
		}

		this.setStatus(InstanceStatus.Connecting)

		// Replies are matched by IP address, so hostnames are resolved first
		let ip = host
		if (!net.isIPv4(host)) {
			try {
				ip = (await lookup(host, { family: 4 })).address
			} catch (error) {
				if (generation !== this.connectGeneration) return
				this.setStatus(InstanceStatus.ConnectionFailure, `Cannot resolve ${host}: ${error.message}`)
				this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_INTERVAL)
				return
			}
			if (generation !== this.connectGeneration) return
		}

		const protocol = this.options.protocol
		const camera = new MarshallCamera(ip, {
			port: this.options.port,
			protocol:
				protocol && /** @type {string[]} */ (Object.values(Protocols)).includes(protocol) ? protocol : undefined,
		})
		camera.on('error', (error) => this.log('debug', `VISCA: ${error.message}`))
		camera.connection.on('debug', (message) => this.log('debug', message))
		this.camera = camera
		this.polledInquiries = new Set(PolledInquiries)

		this.checkConnection()
	}

	disconnect() {
		// Invalidates a pending hostname lookup of connect()
		this.connectGeneration++
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
		if (!camera) return

		camera.connect().then(
			() => {
				if (camera !== this.camera) return
				this.setStatus(InstanceStatus.Ok)
				this.inquire('version')
				this.startPolling()
			},
			(error) => {
				if (camera !== this.camera) return
				this.connectionFailed(error.message)
			},
		)
	}

	/**
	 * @param {string} message
	 */
	connectionFailed(message) {
		if (this.reconnectTimer) return
		this.stopPolling()
		this.setStatus(InstanceStatus.ConnectionFailure, message)
		this.reconnectTimer = setTimeout(() => this.checkConnection(), RECONNECT_INTERVAL)
	}

	startPolling() {
		this.stopPolling()
		const interval = this.options.pollInterval
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

	/**
	 * @param {string} key  Key of the inquiry
	 */
	async inquire(key) {
		const camera = this.camera
		if (!camera) return
		try {
			const answer = await camera.sendInquiry(inquiries[key]).answer
			if (camera !== this.camera) return
			this.updateState(InquiryVariables[key](answer))
			if (key === 'power') this.setStatus(InstanceStatus.Ok)
		} catch (reason) {
			if (camera !== this.camera) return
			if (isTimeout(reason)) {
				// The power inquiry is the keepalive, other inquiries time out at the same time
				if (key === 'power') this.connectionFailed(reasonToMessage(reason))
			} else if (isUnsupported(reason) && this.polledInquiries.delete(key)) {
				// 'Command not executable' (e.g. in standby) is temporary, a syntax error is not
				this.log(
					'debug',
					`Inquiry "${inquiries[key].name}" is not supported and no longer polled: ${reasonToMessage(reason)}`,
				)
			}
		}
	}

	/**
	 * Stores variable values and reports the changed ones.
	 *
	 * @param {Record<string, import('@companion-module/base').JsonValue | undefined>} values
	 */
	updateState(values) {
		/** @type {CameraState} */
		const changed = {}
		for (const [id, value] of Object.entries(values)) {
			if (value !== undefined && this.state[id] !== value) {
				this.state[id] = value
				changed[id] = value
			}
		}
		if (Object.keys(changed).length) {
			this.options.onStateChange(this, changed)
		}
	}

	/**
	 * @param {any} command  Command of the VISCA library
	 * @param {Record<string, any>} parameterDict
	 */
	sendCommand(command, parameterDict) {
		const camera = this.camera
		if (!camera) {
			this.log('warn', `Cannot send "${command.name}": not connected`)
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
				this.setStatus(InstanceStatus.Ok)
				if (command === commands['preset/recall'] || command === commands['preset/set']) {
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
