const Message = require('./Message')
const utils = require('./utils')
const async = require('async')

class ViscaController {
    constructor(connection, address=1, n_sockets=2) {
        this.n_sockets = n_sockets
        this.address = address
        this._send = connection.send.bind(connection)
        connection.on('message', this._recive.bind(this))

        this.awaitedMessages = {}

        this.sendingQueue = new async.queue(this._queueWorker.bind(this), this.n_sockets)
    }

    _queueWorker(message, releaseSocket) {
        this._sendMessage(message, releaseSocket)
    }

    _queueMessage(message) {
        this.sendingQueue.push(message)
    }

    _sendMessage(message, releaseSocket=()=>{}) {
        message.startSending(releaseSocket)
        let sequenceNumber = this._sendVisca(message.type, message.payload)
        message.wasSent()
        this.awaitedMessages[sequenceNumber] = message
    }

    _sendVisca(type, payload) {
        let typeBuffer = Buffer.from(type)
        let sequenceNumber = this.pullSequenceNumber()
        let payloadLength = utils.uintToByteArray(payload.length, 2)
        let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
        let payloadBuffer = Buffer.from(payload)
        let data = Buffer.concat([typeBuffer, payloadLength, byteSequenceNumber, payloadBuffer])
        this._send(data)

       return sequenceNumber
    }

    _recive(data) {
        try {
            var sequenceNumber = utils.byteArrayToUint(data.slice(4, 8));
        } catch (error) {
            throw SyntaxError('Visca Syntax Error')
        }
        if (!this.awaitedMessages.hasOwnProperty(sequenceNumber)) {
            console.log(`Received message with unknown sequence number: ${sequenceNumber}`)
        } else {
            var message = this.awaitedMessages[sequenceNumber]
        }
    
        try {
            var type = data.slice(0, 2);
        } catch (error) {
            throw SyntaxError('Visca Syntax Error')
        }
        if (Buffer.from(message.expectedType).compare(type) != 0) {
            throw SyntaxError('Visca Syntax Error: Unexpected payload type');
        }

        try {
            let payloadLength = utils.byteArrayToUint(data.slice(2, 4));
            var payload = data.slice(8, 8 + payloadLength);
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Package size')
        }
        
        message.receiveReply([...payload]) // Convert Uint8Array to number array
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

    pullSequenceNumber() {
        if (this._sequenceCounter === undefined) {
            this.resetSequenceCounter()
        }
        this._sequenceCounter += 1
        if (this.sequenceCounter > 0xFFFFFFFF) {
            this.resetSequenceCounter()
        }
        return this._sequenceCounter
    }

    resetSequenceCounter() {
        let reset_cmd = Buffer.from([0x01])
        this._sequenceCounter = -1
        let message = new Message.ControlCommand(reset_cmd)
        this.sendingQueue.push(message)
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

module.exports = ViscaController