const { Udp } = require('../Connection')
const ViscaOverIpSocket = require('../ViscaSocket')
const ViscaCamera = require('../ViscaCamera')
const { nSockets } = require('./lookupTables')

class MarshallCamera extends ViscaCamera {
    constructor(ip, { port=52381, address=1, timeouts }={}) {
        const connection = new Udp(ip, port)
        const viscaSocket = new ViscaOverIpSocket(connection, address, nSockets)

        super(viscaSocket, nSockets, timeouts)
        this.address = address
        this.connection = connection
    }

    sendCommand(command, parameterDict) {
        return super.sendCommand(command, { 'Address': this.address, ...parameterDict })
    }
}

module.exports = MarshallCamera
