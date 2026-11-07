import EventEmitter from 'node:events'
import dgram from 'node:dgram'
import net from 'node:net'

class AbstractConnection extends EventEmitter {
	connected = true

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
	constructor(ip, port = 52381) {
		super()
		this.ip = ip
		this.port = port
		this.closed = false

		// The socket is not connected, so sending works right away and a send error does not end the connection
		this._socket = dgram.createSocket('udp4')
		this._socket.on('error', (err) => this.emit('error', err))
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
		this._socket.send(dataBuffer, this.port, this.ip, (err) => {
			if (err) {
				this.emit('error', err)
			}
		})
	}

	_receive(dataBuffer) {
		const dataArray = [...dataBuffer]
		super._receive(dataArray)
	}

	close() {
		if (this.closed) {
			return
		}
		this.closed = true
		this._socket.close()
		super.close()
	}
}

/**
 * TCP connection that reconnects automatically. Received data is emitted as it arrives,
 * splitting it into messages is up to the user.
 */
class Tcp extends AbstractConnection {
	constructor(host, port, reconnectInterval = 2000) {
		super()
		this.host = host
		this.port = port
		this.reconnectInterval = reconnectInterval
		this.connected = false
		this.closed = false
		this._connect()
	}

	_connect() {
		this._socket = net.createConnection({ host: this.host, port: this.port })
		this._socket.setNoDelay(true)
		this._socket.on('connect', () => {
			this.connected = true
			this.emit('connect')
		})
		this._socket.on('data', (dataBuffer) => this._receive([...dataBuffer]))
		this._socket.on('error', (err) => this.emit('error', err))
		this._socket.on('close', () => {
			this.connected = false
			if (!this.closed) {
				this._reconnectTimer = setTimeout(() => this._connect(), this.reconnectInterval)
			}
		})
	}

	send(dataArray) {
		if (!this.connected) {
			this.emit('error', new Error('Cannot send, not connected'))
			return
		}
		super.send(dataArray)
		this._socket.write(Buffer.from(dataArray))
	}

	close() {
		if (this.closed) {
			return
		}
		this.closed = true
		clearTimeout(this._reconnectTimer)
		this._socket.destroy()
		super.close()
	}
}

export { Udp, Tcp }
