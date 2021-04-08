const Message = require('./Message')
const utils = require('./utils')

class ViscaSocket {
    constructor(connection, address=1, nSockets=2) {
        this.nSockets = nSockets
        this.address = address
        this.connection = connection
        connection.on('message', this._recive.bind(this))

        this.awaitedMessages = {}
    }

    sendMessage(message) {
        let sequenceNumber = this._sendPayload(message.type, message.payload)
        this.awaitedMessages[sequenceNumber] = message
    }

    _sendPayload(type, payload) {
        let typeBuffer = Buffer.from(type)
        let sequenceNumber = this.pullSequenceNumber()
        let payloadLength = utils.uintToByteArray(payload.length, 2)
        let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
        let payloadBuffer = Buffer.from(payload)
        let data = Buffer.concat([typeBuffer, payloadLength, byteSequenceNumber, payloadBuffer])
        this.connection.send(data)

       return sequenceNumber
    }

    _recive(data) {
        try {
            var sequenceNumber = utils.byteArrayToUint(data.slice(4, 8));
        } catch (error) {
            throw SyntaxError('Visca Syntax Error')
        }
        if (!(sequenceNumber in this.awaitedMessages)) {
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
        this.sendMessage(message)
    }
}

module.exports = ViscaSocket