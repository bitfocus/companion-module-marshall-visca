const EventEmitter = require('events')
const dgram = require('dgram')

class AbstractConnection extends EventEmitter {
    send(dataArray) {
        this._logMessage('Sending', dataArray)
    }

    close() {
        this.emit('close')
    }

    _receive(dataArray) {
        this._logMessage('Received', dataArray)
        this.emit('message', dataArray)
    }

    _logMessage(topic, dataArray) {
        this.emit('debug', `${topic} ${Buffer.from(dataArray).toString('hex').toUpperCase().match(/../g).join(' ')}`)
    }
}

class Udp extends AbstractConnection {
    constructor(ip, port=52381) {
        super()
        this.ip = ip
        this.port = port
        this.closed = false

        // The socket is not connected, so sending works right away and a send error does not end the connection
        this._socket = dgram.createSocket('udp4')
        this._socket.on('error', err => this.emit('error', err))
        this._socket.on('message', (dataBuffer, rinfo) => {
            if (rinfo.address === this.ip) {
                this._receive(dataBuffer)
            }
        })
    }

    send(dataArray) {
        if (this.closed) {
            this.emit('error', new Error('Cannot send, connection is closed'))
            return
        }
        const dataBuffer = Buffer.from(dataArray)
        super.send(dataBuffer)
        this._socket.send(dataBuffer, this.port, this.ip, err => {
            if (err) { this.emit('error', err) }
        })
    }

    _receive(dataBuffer) {
        const dataArray = [ ...dataBuffer ]
        super._receive(dataArray)
    }

    close() {
        if (this.closed) { return }
        this.closed = true
        this._socket.close()
        super.close()
    }
}

module.exports = {
    Udp
}