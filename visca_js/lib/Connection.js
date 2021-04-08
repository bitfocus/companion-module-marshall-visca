const EventEmitter = require('events')
const dgram = require('dgram')

class AbstractConnection extends EventEmitter {
    send(message) {
        this._logMessage('Sending', message)
    }

    close() {
        this.emit('close')
    }

    _receive(message) {
        this._logMessage('Received', message)
        this.emit('message', message)
    }

    _logMessage(topic, message) {
        console.debug(topic, Buffer.from(message).toString('hex').toUpperCase().match(/../g).join(' '))
    }
}

class Udp extends AbstractConnection {
    constructor(ip, port=52381) {
        super()
        this._socket = dgram.createSocket('udp4')

        this._socket.connect(port, ip, () => this.emit('connect'))
        
        this._socket.on('error', err => {
            this.emit('error', err)
            this.close()
        })

        this._socket.on('message', this._receive.bind(this))
    }

    send(message) {
        super.send(message)
        this._socket.send(message)
    }

    close() {
        this._socket.close()
        this.emit('close')
    }
}

module.exports = {
    Udp
}