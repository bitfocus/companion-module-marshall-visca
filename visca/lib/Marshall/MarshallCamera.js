import { Tcp, Udp } from '../Connection.js'
import RawViscaSocket from '../RawViscaSocket.js'
import ViscaOverIpSocket from '../ViscaSocket.js'
import ViscaCamera from '../ViscaCamera.js'
import { nSockets } from './lookupTables.js'

export const Protocols = Object.freeze({
	VISCA_OVER_IP: 'visca-over-ip',
	RAW_TCP: 'raw-tcp',
	RAW_UDP: 'raw-udp',
})

class MarshallCamera extends ViscaCamera {
	/**
	 * @param {string} ip
	 * @param {object} [options]
	 * @param {number} [options.port=52381]
	 * @param {number} [options.address=1]
	 * @param {string} [options.protocol]  One of Protocols, VISCA over IP (UDP with header) by default.
	 * @param {object} [options.timeouts]  See ViscaCamera.
	 */
	constructor(ip, { port = 52381, address = 1, protocol = Protocols.VISCA_OVER_IP, timeouts } = {}) {
		let connection, viscaSocket
		switch (protocol) {
			case Protocols.RAW_TCP:
				connection = new Tcp(ip, port)
				viscaSocket = new RawViscaSocket(connection)
				break
			case Protocols.RAW_UDP:
				connection = new Udp(ip, port)
				viscaSocket = new RawViscaSocket(connection)
				break
			case Protocols.VISCA_OVER_IP:
				connection = new Udp(ip, port)
				viscaSocket = new ViscaOverIpSocket(connection, address, nSockets)
				break
			default:
				throw new Error(`Unknown protocol: ${protocol}`)
		}

		// Without sequence numbers replies cannot be assigned to parallel requests
		super(viscaSocket, viscaSocket instanceof RawViscaSocket ? 1 : nSockets, timeouts)
		this.address = address
		this.connection = connection
	}

	sendCommand(command, parameterDict) {
		return super.sendCommand(command, { Address: this.address, ...parameterDict })
	}

	sendInquiry(inquiry, parameterDict) {
		return super.sendInquiry(inquiry, { Address: this.address, ...parameterDict })
	}
}

export default MarshallCamera
