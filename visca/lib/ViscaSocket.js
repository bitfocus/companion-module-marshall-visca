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

/**
 * Assigns VISCA replies to the waiting requests by their content.
 *
 * Sequence numbers (VISCA over IP) are not reliable: some cameras stamp every reply with the
 * sequence number they received last. Raw VISCA has none at all. Instead:
 * - Only one message waits for its first reply (ack, answer or error) at a time,
 *   so the first reply always belongs to it.
 * - An ack (x0 4Y FF) assigns socket Y to the command, its completion (x0 5Y FF) or
 *   error (x0 6Y .. FF) is routed by that socket number while other messages are sent.
 */
class ReplyRouter {
	constructor() {
		this._awaitingFirstReply = undefined
		this._executing = new Map()
	}

	/**
	 * @param {OpenViscaSocket} openViscaSocket  Socket of a message that was just sent.
	 */
	add(openViscaSocket) {
		this._awaitingFirstReply?.close(new Error('New message sent before the previous one was answered'))
		this._awaitingFirstReply = openViscaSocket
		openViscaSocket.on('close', () => {
			if (this._awaitingFirstReply === openViscaSocket) {
				this._awaitingFirstReply = undefined
			}
			for (const [socket, executing] of this._executing) {
				if (executing === openViscaSocket) {
					this._executing.delete(socket)
				}
			}
		})
	}

	/**
	 * @returns {boolean}  Whether the payload was assigned to a socket.
	 */
	route(payload) {
		const type = payload[1] & 0xf0
		const socket = payload[1] & 0x0f

		if ((type === 0x50 || type === 0x60) && socket > 0 && this._executing.has(socket)) {
			const executing = this._executing.get(socket)
			this._executing.delete(socket)
			executing.incoming(payload)
			return true
		}

		const awaiting = this._awaitingFirstReply
		if (!awaiting) {
			return false
		}
		this._awaitingFirstReply = undefined
		if (type === 0x40 && socket > 0) {
			this._executing.get(socket)?.close(new Error(`Socket ${socket} was reused by the camera`))
			this._executing.set(socket, awaiting)
		}
		awaiting.incoming(payload)
		return true
	}

	close(reason) {
		this._awaitingFirstReply?.close(reason)
		for (const executing of [...this._executing.values()]) {
			executing.close(reason)
		}
	}
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
	constructor(connection, address = 1, resetTimeout = 1000) {
		super()
		this.address = address
		this.resetTimeout = resetTimeout
		this.connection = connection
		connection.on('message', this._receive.bind(this))
		connection.on('error', (error) => this.emit('error', error))

		this._sequenceNumber = undefined
		this._sequenceNumberReset = undefined

		// Control messages (sequence number reset) are assigned by sequence number, VISCA replies by the router
		this.openViscaSockets = new Map()
		this.replyRouter = new ReplyRouter()
	}

	async sendMessage(message) {
		const sequenceNumber = await this._nextSequenceNumber()
		const payloadType = ViscaPacketPayloadTypeMapping[message.command.type]
		const payloadTypeBytes = PayloadTypeBytes[payloadType]
		const payload = message.getFinalPayload()

		const openViscaSocket = new OpenViscaSocket()
		// Register the socket before sending, so that a fast reply is not lost
		this.replyRouter.add(openViscaSocket)
		this._sendData(payloadTypeBytes, sequenceNumber, payload)
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
		for (const openViscaSocket of [...this.openViscaSockets.values()]) {
			openViscaSocket.close(new Error('Connection closed'))
		}
		this.replyRouter.close(new Error('Connection closed'))
		this.connection.close()
	}

	_sendData(type, sequenceNumber, payload) {
		const payloadLength = utils.uintToByteArray(payload.length, 2)
		const byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
		this.connection.send([...type, ...payloadLength, ...byteSequenceNumber, ...payload])
	}

	/**
	 * Sends a control message, its reply is assigned by the sequence number.
	 */
	async _sendControl(type, sequenceNumber, payload) {
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
		this._sendData(type, sequenceNumber, payload)

		return newOpenViscaSocket
	}

	_receive(data) {
		if (data.length < 8) {
			this.emit('error', new SyntaxError(`Visca Syntax Error: Message too short (${data.length} bytes)`))
			return
		}

		const payloadLength = utils.byteArrayToUint(data.slice(2, 4))
		const payload = data.slice(8, 8 + payloadLength)
		if (payload.length !== payloadLength) {
			this.emit('error', new SyntaxError('Visca Syntax Error: Payload length does not match'))
			return
		}

		const isControlReply = data[0] === 0x02 && data[1] === 0x01
		if (isControlReply) {
			const sequenceNumber = utils.byteArrayToUint(data.slice(4, 8))
			this.openViscaSockets.get(sequenceNumber)?.incoming(payload)
		} else if (!this.replyRouter.route(payload)) {
			this.emit('debug', `Ignored unexpected reply: ${utils.byteArrayToHexString(payload)}`)
		}
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
		const openViscaSocket = await this._sendControl(type, sequenceNumber, payload)
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

export { AbstractViscaSocket, OpenViscaSocket, ReplyRouter, ViscaOverIpSocket }
export default ViscaOverIpSocket
