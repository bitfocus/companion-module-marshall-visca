const utils = require('./utils')

// This is just for reference
class AbstractViscaSocket {
    async sendMessage(message) {
        return (function*() {
            yield Promise.reject(new Error('Abstract Visca Socket used', message))
        })()
    }
}

class ViscaOverIpSocket extends AbstractViscaSocket {
    constructor(connection, address=1, nSockets=2) {
        super()
        this.nSockets = nSockets
        this.address = address
        this.connection = connection
        connection.on('message', this._receive.bind(this))

        this.sequenceNumber = this._sequenceNumberGenerator()

        this.receiveHandlers = new Map()
    }

    async sendMessage(message) {
        const sequenceNumber = (await this.sequenceNumber.next()).value
        const responseGenerator = await this._send(message.type, sequenceNumber, message.payload)
        return responseGenerator
    }

    async _send(type, sequenceNumber, payload) {
        let typeBuffer = Buffer.from(type)
        let payloadLength = utils.uintToByteArray(payload.length, 2)
        let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
        let payloadBuffer = Buffer.from(payload)
        let data = Buffer.concat([typeBuffer, payloadLength, byteSequenceNumber, payloadBuffer])
        this.connection.send(data)

        if (this.receiveHandlers.has(sequenceNumber)) {
            const awaitedMessage = this.receiveHandlers.get(sequenceNumber)
            awaitedMessage.reject(new Error('New message for same sequence number created'))
        }
        const receiveHandler = this._createReceiveHandler(sequenceNumber)
        this.receiveHandlers.set(sequenceNumber, receiveHandler)

        return receiveHandler.generator
    }

    _createReceiveHandler(sequenceNumber) {
        const receiveHandler = {
            resolve: () => {},
            reject: () => {},
            generator: undefined
        }
        receiveHandler.generator = (async function*(receiveHandlers) {
            while (true) {
                let promise = new Promise((resolve, reject) => {
                    receiveHandler.resolve = resolve.bind(this)
                    receiveHandler.reject = reject.bind(this)
                })
                try {
                    yield promise
                } catch(error) {
                    // generator.throw() was called
                    receiveHandlers.delete(sequenceNumber)
                    return
                }
                try {
                    await promise
                } catch(error) {
                    // promise.reject() was called
                    receiveHandlers.delete(sequenceNumber)
                    return
                }
            }
        })(this.receiveHandlers)
        return receiveHandler
    }

    _receive(data) {
        try {
            var sequenceNumber = utils.byteArrayToUint(data.slice(4, 8));
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Sequence number')
        }

        const receiveHandler = this.receiveHandlers.get(sequenceNumber)
        if (!receiveHandler) {
            console.debug(`Received message with unknown sequence number: ${sequenceNumber}`)
            return
        } 
        
        try {
            var payloadLength = utils.byteArrayToUint(data.slice(2, 4));
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Payload length')
        }
        try {
            var payload = data.slice(8, 8 + payloadLength);
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Reading payload')
        }
        
        receiveHandler.resolve([ ...payload ]) // Convert Uint8Array to number array
    }

    async *_sequenceNumberGenerator() {
        while (true) {
            var sequenceNumber = await this._resetSequenceCounter()
            while (sequenceNumber < 0xFF_FF_FF_FF) {
                yield sequenceNumber++
            }
        }
    }

    async _resetSequenceCounter() {
        const type = [0x02, 0x00]
        const sequenceNumber = 0
        const payload = [0x01]
        const responseGenerator = await this._send(type, sequenceNumber, payload)
        for await (let response of responseGenerator) {
            if (response.length === 1 && response[0] === 1) {
                return 1 // Next sequence number
            } else {
                throw new Error("Invalid response for Sequence Counter Reset")
            }
        }
        throw new Error("Expect response for Sequence Counter Reset")
    }
}

module.exports = ViscaOverIpSocket