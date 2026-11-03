import { AbstractViscaSocket, OpenViscaSocket, ReplyRouter } from './ViscaSocket.js'

/**
 * Plain VISCA without the VISCA over IP header (e.g. over TCP or UDP).
 * Replies carry no sequence number, they are assigned by the ReplyRouter.
 */
class RawViscaSocket extends AbstractViscaSocket {
	constructor(connection, connectTimeout = 2000) {
		super()
		this.connection = connection
		this.connectTimeout = connectTimeout
		this._buffer = []
		this.replyRouter = new ReplyRouter()

		connection.on('message', this._receive.bind(this))
		connection.on('error', (error) => this.emit('error', error))
	}

	async sendMessage(message) {
		if (!this.connection.connected) {
			throw new Error('Not connected')
		}
		const payload = message.getFinalPayload()

		const openViscaSocket = new OpenViscaSocket()
		this.replyRouter.add(openViscaSocket)
		this.connection.send(payload)

		return openViscaSocket
	}

	/**
	 * Resolves once the connection is established (immediately for connectionless transports).
	 */
	async connect() {
		if (this.connection.connected) {
			return
		}
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.connection.off('connect', onConnect)
				reject(new Error(`Could not connect within ${this.connectTimeout} ms`))
			}, this.connectTimeout)
			const onConnect = () => {
				clearTimeout(timer)
				resolve()
			}
			this.connection.once('connect', onConnect)
		})
	}

	close() {
		this.replyRouter.close(new Error('Connection closed'))
		this.connection.close()
	}

	_receive(data) {
		// A message ends with FF, a TCP chunk or UDP datagram can hold several or partial messages
		this._buffer.push(...data)
		let end
		while ((end = this._buffer.indexOf(0xff)) !== -1) {
			const payload = this._buffer.splice(0, end + 1)
			if (!this.replyRouter.route(payload)) {
				this.emit('debug', `Ignored unexpected reply: ${Buffer.from(payload).toString('hex').toUpperCase()}`)
			}
		}
	}
}

export default RawViscaSocket
