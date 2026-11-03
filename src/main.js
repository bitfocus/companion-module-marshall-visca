import { InstanceBase, InstanceStatus, Regex } from '@companion-module/base'
import MarshallCamera from '../visca/lib/Marshall/MarshallCamera.js'
import { getActionDefinitions } from './actions.js'
import { UpgradeScripts } from './upgrades.js'

export { UpgradeScripts }

const RECONNECT_INTERVAL = 5000

export default class MarshallViscaInstance extends InstanceBase {
	async init(config) {
		this.config = config

		this.setActionDefinitions(getActionDefinitions(this.sendCommand.bind(this)))

		this.connect()
	}

	async destroy() {
		this.disconnect()
	}

	async configUpdated(config) {
		this.config = config
		this.connect()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Controls Marshall CV cameras with VISCA over IP (UDP). Enable VISCA over IP in the network settings of the camera.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Camera IP',
				width: 8,
				regex: Regex.IP,
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
		]
	}

	connect() {
		this.disconnect()

		const host = this.config.host
		if (!host || !new RegExp(Regex.IP.slice(1, -1)).test(host)) {
			this.updateStatus(InstanceStatus.BadConfig, 'Camera IP missing or invalid')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		const camera = new MarshallCamera(host, { port: Number(this.config.port) || 52381 })
		camera.on('error', (error) => this.log('debug', `VISCA: ${error.message}`))
		camera.connection.on('debug', (message) => this.log('debug', message))
		this.camera = camera

		this.checkConnection()
	}

	disconnect() {
		clearTimeout(this.reconnectTimer)
		this.reconnectTimer = undefined
		if (this.camera) {
			this.camera.close()
			this.camera = undefined
		}
	}

	checkConnection() {
		const camera = this.camera
		clearTimeout(this.reconnectTimer)
		this.reconnectTimer = undefined

		camera.connect().then(
			() => {
				if (camera === this.camera) this.updateStatus(InstanceStatus.Ok)
			},
			(error) => {
				if (camera !== this.camera) return
				this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
				this.reconnectTimer = setTimeout(() => this.checkConnection(), RECONNECT_INTERVAL)
			},
		)
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
				if (camera === this.camera) this.updateStatus(InstanceStatus.Ok)
			},
			(reason) => {
				if (camera !== this.camera) return
				const message = reason instanceof Error ? reason.message : (reason?.packet?.name ?? String(reason))
				this.log('warn', `Command "${command.familyName ?? ''} ${command.name}" failed: ${message}`)
				if (reason instanceof Error && /Timeout|did not answer/.test(reason.message) && !this.reconnectTimer) {
					this.updateStatus(InstanceStatus.ConnectionFailure, message)
					this.checkConnection()
				}
			},
		)
	}
}
