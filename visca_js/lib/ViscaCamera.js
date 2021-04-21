const { ActionRequest } = require('./Request')
const async = require('async')

class ViscaCamera {
    constructor(viscaSocket, address=1, nSockets=2) {
        this.viscaSocket = viscaSocket
        this.address = address
        this.nSockets = nSockets

        this.packets = []

        this.sendingQueue = new async.queue(this._queueWorker.bind(this), this.nSockets)
    }
    
    _queueWorker(request, releaseSocket) {
        this._sendRequest(request)
        releaseSocket()
    }

    _queueRequest(request) {
        this.sendingQueue.push(request)
    }

    _sendRequest(request) {
        this.viscaSocket.sendMessage(request).then((openViscaSocket) => {
            request.confirmSent()
            openViscaSocket.on('message', (payload) => {
                request.receiveReply(payload)
            })
        })
    }

    sendViscaMessage(message) {
        let request = new ActionRequest(message)
        this._queueRequest(request)
        return request
    }
}

module.exports = ViscaCamera