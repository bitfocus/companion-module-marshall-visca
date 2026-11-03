import EventEmitter from 'node:events'
import { ActionRequest, InquiryRequest } from './Request.js'

class ViscaCamera extends EventEmitter {
	/**
	 * @param {ViscaOverIpSocket} viscaSocket
	 * @param {number} [nSockets=2]               Number of command buffers of the camera, limits the requests in flight.
	 * @param {object} [timeouts]
	 * @param {number} [timeouts.ack=1000]        Time in ms to wait for the ack of a command or the answer of an inquiry.
	 * @param {number} [timeouts.completion=30000] Time in ms to wait for the completion of a command.
	 */
	constructor(viscaSocket, nSockets = 2, { ack = 1000, completion = 30000 } = {}) {
		super()
		this.viscaSocket = viscaSocket
		this.nSockets = nSockets
		this.timeouts = { ack, completion }

		this._queue = []
		this._nActiveRequests = 0

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
		while (this._nActiveRequests < this.nSockets && this._queue.length) {
			const request = this._queue.shift()
			this._nActiveRequests++
			this._sendRequest(request).finally(() => {
				this._nActiveRequests--
				this._processQueue()
			})
		}
	}

	async _sendRequest(request) {
		let openViscaSocket
		let timer
		try {
			openViscaSocket = await this.viscaSocket.sendMessage(request)
			request.confirmSent()

			openViscaSocket.on('message', (payload) => {
				try {
					request.receiveReply(payload)
				} catch (error) {
					// The reply belongs to this request (same sequence number), so it cannot succeed anymore
					request.fail(error)
					this.emit('error', error)
				}
			})
			openViscaSocket.on('close', (reason) => request.fail(reason ?? new Error('Socket closed')))

			const withTimeout = (promise, ms, name) =>
				new Promise((resolve, reject) => {
					timer = setTimeout(() => reject(new Error(`Timeout: no ${name} received after ${ms} ms`)), ms)
					promise.then(resolve, reject).finally(() => clearTimeout(timer))
				})
			if (request instanceof ActionRequest) {
				await withTimeout(request.ack, this.timeouts.ack, 'ack')
				await withTimeout(request.completion, this.timeouts.completion, 'completion')
			} else {
				await withTimeout(request.completion, this.timeouts.ack, 'answer')
			}
		} catch (error) {
			request.fail(error)
		} finally {
			clearTimeout(timer)
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
