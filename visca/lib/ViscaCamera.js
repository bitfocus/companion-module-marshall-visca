const EventEmitter = require('events')
const { ActionRequest } = require('./Request')

class ViscaCamera extends EventEmitter {
    /**
     * @param {ViscaOverIpSocket} viscaSocket
     * @param {number} [nSockets=2]               Number of command buffers of the camera, limits the requests in flight.
     * @param {object} [timeouts]
     * @param {number} [timeouts.ack=1000]        Time in ms to wait for the ack of a command.
     * @param {number} [timeouts.completion=30000] Time in ms to wait for the completion of a command.
     */
    constructor(viscaSocket, nSockets=2, { ack=1000, completion=30000 }={}) {
        super()
        this.viscaSocket = viscaSocket
        this.nSockets = nSockets
        this.timeouts = { ack, completion }

        this._queue = []
        this._nActiveRequests = 0

        this.viscaSocket.on('error', error => this.emit('error', error))
    }

    _queueRequest(request) {
        this._queue.push(request)
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

            openViscaSocket.on('message', payload => {
                try {
                    request.receiveReply(payload)
                } catch (error) {
                    this.emit('error', error)
                }
            })
            openViscaSocket.on('close', reason => request.fail(reason ?? new Error('Socket closed')))

            const withTimeout = (promise, ms, name) => new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error(`Timeout: no ${name} received after ${ms} ms`)), ms)
                promise.then(resolve, reject).finally(() => clearTimeout(timer))
            })
            await withTimeout(request.ack, this.timeouts.ack, 'ack')
            await withTimeout(request.completion, this.timeouts.completion, 'completion')
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

    close() {
        for (const request of this._queue.splice(0)) {
            request.fail(new Error('Camera connection closed'))
        }
        this.viscaSocket.close()
    }
}

module.exports = ViscaCamera
