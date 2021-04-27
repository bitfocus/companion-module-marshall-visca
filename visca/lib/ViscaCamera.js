const { ActionRequest } = require('./Request')
const CommandSet = require('./CommandSet')
const async = require('async')

const commands = new CommandSet([])

class ViscaCamera {
    static get COMMANDS() {
        return commands
    }

    constructor(viscaSocket, address=1, nSockets=2) {
        this.viscaSocket = viscaSocket
        this.address = address
        this.nSockets = nSockets

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

    sendCommand(command, parameterDict) {
        const request = new ActionRequest(command, parameterDict)
        this._queueRequest(request)
        return request
    }
}

module.exports = ViscaCamera