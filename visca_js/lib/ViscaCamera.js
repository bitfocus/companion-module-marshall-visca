const Message = require('./Message')
const async = require('async')

class ViscaCamera {
    constructor(viscaSocket, address=1, nSockets=2) {
        this.viscaSocket = viscaSocket
        this.address = address
        this.nSockets = nSockets

        this.sendingQueue = new async.queue(this._queueWorker.bind(this), this.nSockets)
    }
    
    _queueWorker(message, releaseSocket) {
        this._sendMessage(message)
        releaseSocket()
    }

    _queueMessage(message) {
        this.sendingQueue.push(message)
    }

    _sendMessage(message) {
        this.viscaSocket.sendMessage(message)
    }

    sendViscaCommand(commandName, parameters={}) {
        let commandObject = this.getPacket(['command'].concat(commandName))
        let message = new Message.ViscaCommand(commandObject, {'Address': this.address, ...parameters})
        this._queueMessage(message)
        return message
    }

    sendViscaInquery(command) {
        let commandObject = this.getPacket(['inquery'].concat(command))
        let message = new Message.ViscaInquery(commandObject, {'Address': this.address})
        this._sendMessage(message)
        return message
    }

    sendViscaDeviceSettingCommand(command, parameters={}) {
        let commandObject = this.getPacket(['device setting command'].concat(command))
        let message = new Message.ViscaDeviceSettingCommand(commandObject, {'Address': this.address, ...parameters});
        this._sendMessage(message);
        return message
    }

    getPacket (packetNames=[], rootPacket=this._requestSet) {
        if (packetNames.length === 0) {
            return rootPacket
        }
        let newRootPacket = rootPacket.packets[packetNames[0]]
        if (typeof newRootPacket === 'undefined') {
            throw Error(`Could not find packet with name ${packetNames[0]} in root packet ${rootPacket.name}`)
        }
        return this.getPacket(packetNames.slice(1), newRootPacket)
    }
}

module.exports = ViscaCamera