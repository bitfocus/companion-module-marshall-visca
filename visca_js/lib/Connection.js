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
        console.debug(topic, Buffer.from(dataArray).toString('hex').toUpperCase().match(/../g).join(' '))
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

    send(dataArray) {
        const dataBuffer = Buffer.from(dataArray)
        super.send(dataBuffer)
        this._socket.send(dataBuffer)
    }

    _receive(dataBuffer) {
        const dataArray = [ ...dataBuffer ]
        super._receive(dataArray)
    }

    close() {
        this._socket.close()
        this.emit('close')
    }
}

module.exports = {
    Udp
}