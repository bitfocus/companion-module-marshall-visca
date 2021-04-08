const utils = require('./utils')

class ViscaSocket {
    constructor(connection, address=1, nSockets=2) {
        this.nSockets = nSockets
        this.address = address
        this.connection = connection
        connection.on('message', this._recive.bind(this))

        this.sequenceNumber = this._sequenceNumberGenerator()

        this.awaitedMessages = {}
    }

    async sendMessage(message) {
        let sequenceNumber = await this.sequenceNumber.next().value
        await this._send(message.type, sequenceNumber, message.payload)
        this.awaitedMessages[sequenceNumber] = message
    }

    async _send(type, sequenceNumber, payload) {
        let typeBuffer = Buffer.from(type)
        let payloadLength = utils.uintToByteArray(payload.length, 2)
        let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
        let payloadBuffer = Buffer.from(payload)
        let data = Buffer.concat([typeBuffer, payloadLength, byteSequenceNumber, payloadBuffer])
        this.connection.send(data)
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
        
        try {
            if (Buffer.from(message.expectedType).compare(type) != 0) {
                throw SyntaxError('Visca Syntax Error: Unexpected payload type');
            }
        } catch (error) {
            return
        }

        try {
            let payloadLength = utils.byteArrayToUint(data.slice(2, 4));
            var payload = data.slice(8, 8 + payloadLength);
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Package size')
        }
        
        message.receiveReply([...payload]) // Convert Uint8Array to number array
    }

    async *_sequenceNumberGenerator() {
        while (true) {
            await this.resetSequenceCounter()
            let sequenceNumber = 1
            while (sequenceNumber < 0xFF_FF_FF_FF) {
                yield sequenceNumber++
            }
        }
    }

    async resetSequenceCounter() {
        let type = [0x02, 0x00]
        let sequenceNumber = 0
        let payload = [0x01] 
        await this._send(type, sequenceNumber, payload)
    }
}

module.exports = ViscaSocket