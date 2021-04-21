const { ActionTask } = require('./Task')
const async = require('async')

class ViscaCamera {
    constructor(viscaSocket, address=1, nSockets=2) {
        this.viscaSocket = viscaSocket
        this.address = address
        this.nSockets = nSockets

        this.packets = []

        this.sendingQueue = new async.queue(this._queueWorker.bind(this), this.nSockets)
    }
    
    _queueWorker(task, releaseSocket) {
        this._sendTask(task)
        releaseSocket()
    }

    _queueTask(task) {
        this.sendingQueue.push(task)
    }

    _sendTask(task) {
        this.viscaSocket.sendMessage(task).then((openViscaSocket) => {
            task.confirmSent()
            openViscaSocket.on('message', (payload) => {
                task.receiveReply(payload)
            })
        })
    }

    sendViscaMessage(message) {
        let task = new ActionTask(message)
        this._queueTask(task)
        return task
    }
}

module.exports = ViscaCamera