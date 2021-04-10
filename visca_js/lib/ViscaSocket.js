const EventEmitter = require('events')
const utils = require('./utils')

class OpenViscaSocket extends EventEmitter {
    constructor() {
        super()
        this.closed = false

        this.on('close', () => { this.closed = true }).on('error', (error) => { this.close(error) })
        
    }

    close(...args) {
        this.emit('close', ...args)
    }

    incoming(payload) {
        this.emit('message', payload)
    }
}

// This is just for reference
class AbstractViscaSocket {
    async sendMessage(message) {
        return (new OpenViscaSocket).close('Abstract Visca Socket used', message)
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

        this.openViscaSockets = new Map()
    }

    async sendMessage(message) {
        const sequenceNumber = (await this.sequenceNumber.next()).value
        const openViscaSocket = await this._send(message.type, sequenceNumber, message.payload)
        return openViscaSocket
    }

    async _send(type, sequenceNumber, payload) {
        let payloadLength = utils.uintToByteArray(payload.length, 2)
        let byteSequenceNumber = utils.uintToByteArray(sequenceNumber, 4)
        let dataArray = [
            ...type,
            ...payloadLength,
            ...byteSequenceNumber,
            ...payload
        ]
        this.connection.send(dataArray)

        if (this.openViscaSockets.has(sequenceNumber)) {
            const oldOpenViscaSocket = this.openViscaSockets.get(sequenceNumber)
            oldOpenViscaSocket.close(new Error('New message for same sequence number created'))
        }

        const newOpenViscaSocket = new OpenViscaSocket()
        newOpenViscaSocket.on('close', () => {
            this.openViscaSockets.delete(sequenceNumber)
        })
        this.openViscaSockets.set(sequenceNumber, newOpenViscaSocket)

        return newOpenViscaSocket
    }

    _receive(data) {
        try {
            var sequenceNumber = utils.byteArrayToUint(data.slice(4, 8));
        } catch (error) {
            throw SyntaxError('Visca Syntax Error: Sequence number')
        }

        const openViscaSocket = this.openViscaSockets.get(sequenceNumber)
        if (!openViscaSocket) {
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
        
        openViscaSocket.incoming(payload) // Convert Uint8Array to number array
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
        const openViscaSocket = await this._send(type, sequenceNumber, payload)
        const nextSequenceNumber = await new Promise((resolve, reject) => {
            if (openViscaSocket.closed) {
                reject(new Error('Socket closed before message was received'))
            } else {
                openViscaSocket.on('close', reject)
                openViscaSocket.on('message', payload => {
                    if (payload.length === 1 && payload[0] === 1) {
                        resolve(1)
                    } else {
                        reject(new Error('Invalid response for Sequence Counter Reset'))
                    }
                })
            }
        })
        return nextSequenceNumber
    }
}

module.exports = ViscaOverIpSocket