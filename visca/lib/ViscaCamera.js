import EventEmitter from 'node:events'
import { ActionRequest, InquiryRequest } from './Request.js'

class ViscaCamera extends EventEmitter {
	/**
	 * Sends one request at a time until its first reply (ack, answer or error), because replies are
	 * assigned by order (see ReplyRouter). Commands then wait for their completion while the next
	 * requests are sent; the camera itself rejects commands when its command buffers are full.
	 *
	 * @param {AbstractViscaSocket} viscaSocket
	 * @param {object} [timeouts]
	 * @param {number} [timeouts.ack=1000]        Time in ms to wait for the ack of a command or the answer of an inquiry.
	 * @param {number} [timeouts.completion=30000] Time in ms to wait for the completion of a command.
	 */
	constructor(viscaSocket, { ack = 1000, completion = 30000 } = {}) {
		super()
		this.viscaSocket = viscaSocket
		this.timeouts = { ack, completion }

		this._queue = []
		this._sending = false

		this.viscaSocket.on('error', (error) => this.emit('error', error))
	}

	_queueRequest(request) {
		if (request instanceof ActionRequest) {
			// Commands are triggered by the user and go ahead of queued inquiries (e.g. from polling)
			const idx = this._queue.findIndex((queuedRequest) => queuedRequest instanceof InquiryRequest)
			this._queue.splice(idx === -1 ? this._queue.length : idx, 0, request)
		} else {
			this._queue.push(request)
		}
		this._processQueue()
	}

	_processQueue() {
		if (this._sending || !this._queue.length) {
			return
		}
		const request = this._queue.shift()
		this._sending = true
		let released = false
		const release = () => {
			if (released) return
			released = true
			this._sending = false
			this._processQueue()
		}
		this._sendRequest(request, release).finally(release)
	}

	/**
	 * @param {Request} request
	 * @param {() => void} release  Called as soon as the next request may be sent.
	 */
	async _sendRequest(request, release) {
		let openViscaSocket
		const timers = new Set()
		const withTimeout = (promise, ms, name) =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error(`Timeout: no ${name} received after ${ms} ms`)), ms)
				timers.add(timer)
				promise.then(resolve, reject).finally(() => clearTimeout(timer))
			})

		try {
			openViscaSocket = await this.viscaSocket.sendMessage(request)
			request.confirmSent()

			openViscaSocket.on('message', (payload) => {
				try {
					request.receiveReply(payload)
				} catch (error) {
					// The reply was assigned to this request, so it cannot succeed anymore
					request.fail(error)
					this.emit('error', error)
				}
			})
			openViscaSocket.on('close', (reason) => request.fail(reason ?? new Error('Socket closed')))

			if (request instanceof ActionRequest) {
				// The ack is also resolved when the completion arrives without ack
				await withTimeout(request.ack, this.timeouts.ack, 'ack')
				release()
				await withTimeout(request.completion, this.timeouts.completion, 'completion')
			} else {
				await withTimeout(request.completion, this.timeouts.ack, 'answer')
			}
		} catch (error) {
			request.fail(error)
		} finally {
			timers.forEach((timer) => clearTimeout(timer))
			if (openViscaSocket && !openViscaSocket.closed) {
				openViscaSocket.close()
			}
		}
	}

	sendCommand(command, parameterDict) {
		const request = new ActionRequest(command, parameterDict)
		this._queueRequest(request)
		return request
	}

	/**
	 * @returns {InquiryRequest}  Use `request.answer` to get the received parameters.
	 */
	sendInquiry(inquiry, parameterDict) {
		const request = new InquiryRequest(inquiry, parameterDict)
		this._queueRequest(request)
		return request
	}

	connect() {
		return this.viscaSocket.connect()
	}

	close() {
		for (const request of this._queue.splice(0)) {
			request.fail(new Error('Camera connection closed'))
		}
		this.viscaSocket.close()
	}
}

export default ViscaCamera
