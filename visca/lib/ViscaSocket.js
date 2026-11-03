import EventEmitter from 'node:events'
import { Packet } from './Packets.js'
import * as utils from './utils.js'

class OpenViscaSocket extends EventEmitter {
	constructor() {
		super()
		this.closed = false

		this.on('close', () => {
			this.closed = true
		}).on('error', (error) => {
			this.close(error)
		})
	}

	close(...args) {
		if (this.closed) {
			return
		}
		this.emit('close', ...args)
	}

	incoming(payload) {
		this.emit('message', payload)
	}
}

// This is just for reference
class AbstractViscaSocket extends EventEmitter {
	async sendMessage(message) {
		return new OpenViscaSocket().close('Abstract Visca Socket used', message)
	}

	close() {}
}

const PayloadTypes = Object.freeze({
	VISCA_COMMAND: Symbol('VISCA command'),
	VISCA_INQUERY: Symbol('VISCA inquery'),
	VISCA_REPLY: Symbol('VISCA reply'),
	VISCA_DEVICE_SETTING_COMMAND: Symbol('VISCA device setting command'),
	CONTROL_COMMAND: Symbol('Control command'),
	CONTROL_REPLY: Symbol('Control reply'),
})

const PayloadTypeBytes = Object.freeze({
	[PayloadTypes.VISCA_COMMAND]: [0x01, 0x00],
	[PayloadTypes.VISCA_INQUERY]: [0x01, 0x10],
	[PayloadTypes.VISCA_REPLY]: [0x01, 0x11],
	[PayloadTypes.VISCA_DEVICE_SETTING_COMMAND]: [0x01, 0x20],
	[PayloadTypes.CONTROL_COMMAND]: [0x02, 0x00],
	[PayloadTypes.CONTROL_REPLY]: [0x02, 0x01],
})

const ViscaPacketPayloadTypeMapping = Object.freeze({
	[Packet.TYPES.ERROR]: PayloadTypes.VISCA_REPLY,
	[Packet.TYPES.ACK]: PayloadTypes.VISCA_REPLY,
	[Packet.TYPES.COMPLETION]: PayloadTypes.VISCA_REPLY,
	[Packet.TYPES.ANSWER]: PayloadTypes.VISCA_REPLY,
	[Packet.TYPES.TASK]: PayloadTypes.VISCA_COMMAND,
	[Packet.TYPES.INQUERY]: PayloadTypes.VISCA_INQUERY,
	[Packet.TYPES.DEVICE_SETTING_COMMAND]: PayloadTypes.VISCA_DEVICE_SETTING_COMMAND,
})

class ViscaOverIpSocket extends AbstractViscaSocket {
	constructor(connection, address = 1, nSockets = 2, resetTimeout = 1000) {
		super()
		this.nSockets = nSockets
		this.address = address
		this.resetTimeout = resetTimeout
		this.connection = connection
		connection.on('message', this._receive.bind(this))
		connection.on('error', (error) => this.emit('error', error))

		this._sequenceNumber = undefined
		this._sequenceNumberReset = undefined

		this.openViscaSockets = new Map()
	}

	async sendMessage(message) {
		const sequenceNumber = await this._nextSequenceNumber()
		const payloadType = ViscaPacketPayloadTypeMapping[message.command.type]
		const payloadTypeBytes = PayloadTypeBytes[payloadType]
		const openViscaSocket = await this._send(payloadTypeBytes, sequenceNumber, message.getFinalPayload())
		return openViscaSocket
	}

	/**
	 * Resets the sequence number, which also checks that the camera is reachable.
	 */
	async connect() {
		this._sequenceNumber = undefined
		await this._nextSequenceNumber()
		this._sequenceNumber--
	}

	close() {
		for (const openViscaSocket of this.openViscaSockets.values()) {
			openViscaSocket.close(new Error('Connection closed'))
		}
		this.connection.close()
	}

	async _send(type, sequenceNumber, payload) {
		let payloadLength = utils.uintToByteArray(payload.length, 2)
		let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
		let dataArray = [...type, ...payloadLength, ...byteSequenceNumber, ...payload]

		if (this.openViscaSockets.has(sequenceNumber)) {
			const oldOpenViscaSocket = this.openViscaSockets.get(sequenceNumber)
			oldOpenViscaSocket.close(new Error('New message for same sequence number created'))
		}

		const newOpenViscaSocket = new OpenViscaSocket()
		newOpenViscaSocket.on('close', () => {
			if (this.openViscaSockets.get(sequenceNumber) === newOpenViscaSocket) {
				this.openViscaSockets.delete(sequenceNumber)
			}
		})
		this.openViscaSockets.set(sequenceNumber, newOpenViscaSocket)

		// Register the socket before sending, so that a fast reply is not lost
		this.connection.send(dataArray)

		return newOpenViscaSocket
	}

	_receive(data) {
		if (data.length < 8) {
			this.emit('error', new SyntaxError(`Visca Syntax Error: Message too short (${data.length} bytes)`))
			return
		}

		const sequenceNumber = utils.byteArrayToUint(data.slice(4, 8))
		const openViscaSocket = this.openViscaSockets.get(sequenceNumber)
		if (!openViscaSocket) {
			return
		}

		const payloadLength = utils.byteArrayToUint(data.slice(2, 4))
		const payload = data.slice(8, 8 + payloadLength)
		if (payload.length !== payloadLength) {
			this.emit('error', new SyntaxError('Visca Syntax Error: Payload length does not match'))
			return
		}

		openViscaSocket.incoming(payload)
	}

	async _nextSequenceNumber() {
		if (this._sequenceNumber === undefined || this._sequenceNumber >= 0xff_ff_ff_ff) {
			// Share a running reset between concurrent callers
			this._sequenceNumberReset ??= this._resetSequenceCounter().finally(() => {
				this._sequenceNumberReset = undefined
			})
			this._sequenceNumber = await this._sequenceNumberReset
		}
		return this._sequenceNumber++
	}

	async _resetSequenceCounter() {
		const type = PayloadTypeBytes[PayloadTypes.CONTROL_COMMAND]
		const sequenceNumber = 0
		const payload = [0x01]
		const openViscaSocket = await this._send(type, sequenceNumber, payload)
		try {
			return await new Promise((resolve, reject) => {
				if (openViscaSocket.closed) {
					reject(new Error('Socket closed before message was received'))
					return
				}
				const timer = setTimeout(
					() => reject(new Error(`Camera did not answer the sequence number reset within ${this.resetTimeout} ms`)),
					this.resetTimeout,
				)
				openViscaSocket.on('close', (reason) => {
					clearTimeout(timer)
					reject(reason ?? new Error('Socket closed before message was received'))
				})
				openViscaSocket.on('message', (payload) => {
					clearTimeout(timer)
					if (payload.length === 1 && payload[0] === 1) {
						resolve(1)
					} else {
						reject(new Error('Invalid response for Sequence Counter Reset'))
					}
				})
			})
		} finally {
			openViscaSocket.close()
		}
	}
}

export default ViscaOverIpSocket
