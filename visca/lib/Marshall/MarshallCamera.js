const { Udp } = require('../Connection')
const ViscaOverIpSocket = require('../ViscaSocket')
const ViscaCamera = require('../ViscaCamera')
const { nSockets } = require('./lookupTables')

class MarshallCamera extends ViscaCamera {
    constructor(ip, address=1) {
        const connection = new Udp(ip)
        const viscaSocket = new ViscaOverIpSocket(connection, address, nSockets)

        super(viscaSocket)
    }
}

module.exports = MarshallCamera