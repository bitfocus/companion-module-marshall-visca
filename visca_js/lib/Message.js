const utils = require('./utils')
const { Packet } = require('./requestClasses')

const RequestStates = Object.freeze({
    PENDING: 0,
    SENDING: 1,
    SENT: 2,
    ACK: 3,
    COMPLETED: 4,
    ERROR: -1
})
class Request {
    static get STATES () {
        return RequestStates
    }
    static get type() { return undefined } // Abstract
    static get expectedType() { return [0x01, 0x11] }

    /**
     * 
     * @param {Call} call 
     * @param {Object} parameterDict 
     */
    constructor(call, parameterDict) {
        this._state = RequestStates.SENT;

        this.call = call
        this.parameterDict = parameterDict
        
        this._stateMap = {}
        for (const [name, value] of Object.entries(RequestStates)) {
            this._stateMap[value] = {
                name: name,
                callbacks: [],
                data: undefined,
                parseFunction: undefined
            }
        }
    }

    // eslint-disable-next-line no-unused-vars
    startSending (releaseSocket) {
        this._state = RequestStates.SENDING
    }

    get state() {
        return this._state;
    }

    get type () {
        return this.constructor.type;
    }

    get expectedType () {
        return this.constructor.expectedType;
    }

    get stateObject () {
        return this._stateMap[this.state]
    }

    getFinalPayload() {
        const payload = this.call.pattern.writePayload(this.parameterDict)
        this._state = RequestStates.SENDING
        return payload
    }

    identifyRecievedPayload(payload) {
        for (const reply of this.call.replies) {
            try {
                const parameterDict = reply.pattern.readPayload(payload)
                return { ...reply, parameterDict }
            } catch (error) { }
        }
    }

    receiveReply (payload) {
        console.log(`Payload: ${Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' ')}, name: ${(this._command || {name: []}).name.slice(-1)}, parameters: ${JSON.stringify(this._parameters)}`)
        
        const parseFunction = this.stateObject.parseFunction
        if (parseFunction === undefined) {
            throw Error(`Did not expect incomming message in message state '${this.stateObject.name}'`)
        }

        const identifiedReply = this.identifyRecievedPayload(payload)

        if (identifiedReply === undefined) {
            throw Error('Could not understand message')
        }
        
        if (identifiedReply.type === Packet.TYPES.ERROR) {
            // Continue here
        }
    }

    _setState (value, data) {
        this._state = value
        let stateObject = this._stateMap[value]
        stateObject.data = data
        stateObject.callbacks.map(callback => callback(stateObject.data))
    }

    parseErrors (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address']}
        if (typeof this.socket !== 'undefined') {
            validatorArguments['Socket'] = this.socket
        }
        let [packetName, parameters] = utils.identifyPacket(this._command.error, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }
        
        let errorMessage = 'Recieved error message'
        if (packetName) {
            errorMessage += ` '${packetName}'`
        }
        if (parameters) {
            errorMessage += ` with parameters ${JSON.stringify(parameters)}`
        }
        this._setState(RequestStates.ERROR, errorMessage)
        return true
    } 

    promiseState (state) {
        return new Promise((resolve, reject) => {
            if (this.state < 0) {
                reject(this.stateObject.data)
            } else if (this.state >= state) {
                resolve(this.stateObject.data)
            } else {
                this._stateMap[state].callbacks.push(resolve)
                this._stateMap[RequestStates.ERROR].callbacks.push(reject)
            }
        })
    }
}

class ViscaCommand extends Request {
    static get type () { return [0x01, 0x00] }
    
    constructor(call, parameterDict) {
        super(call, parameterDict)
        
        this._stateMap[RequestStates.SENT].parseFunction = this.parseAck.bind(this)
        this._stateMap[RequestStates.ACK].parseFunction = this.parseCompletion.bind(this)
    }

    startSending (releaseSocket) {
        let saveReleaseSocket = () => { try { releaseSocket() } catch (_) { }}
        this._stateMap[RequestStates.COMPLETED].callbacks.push(saveReleaseSocket)
        this._stateMap[RequestStates.ERROR].callbacks.push(saveReleaseSocket)
        super.startSending(releaseSocket)
    }

    parseAck (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address']}
        let [packetName, parameters] = utils.identifyPacket(this._command.answer, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }
        if (packetName !== 'Ack') {
            throw Error(`Expected acknowledgement message but received '${packetName}' with parameters ${JSON.stringify(parameters)}`)
        }
        
        this.socket = parameters['Socket']
        this._setState(RequestStates.ACK)
        return true
    }

    parseCompletion (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address'], 'Socket': this.socket}
        let [packetName, parameters] = utils.identifyPacket(this._command.answer, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }
        if (packetName !== 'Completion') {
            throw Error(`Expected completion message but received '${packetName}' with parameters ${JSON.stringify(parameters)}`)
        }
        
        this._setState(RequestStates.COMPLETED)
        return true
   }

    get ack () {
        return this.promiseState(RequestStates.ACK)
    }

    get completion () {
        return this.promiseState(RequestStates.COMPLETED)
    }
}

class ViscaInquiry extends Request {
    static get type () { return [0x01, 0x10] }
    
    constructor(command, parameters) {
        super(command, parameters)

        this._stateMap[RequestStates.SENT].parseFunction = this.parseAnswer.bind(this)
    }

    startSending (releaseSocket) {
        let saveReleaseSocket = () => { try { releaseSocket() } catch (_) { }}
        this._stateMap[RequestStates.COMPLETED].callbacks.push(saveReleaseSocket)
        this._stateMap[RequestStates.ERROR].callbacks.push(saveReleaseSocket)
        super.startSending(releaseSocket)
    }

    parseAnswer (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address']}
        
        let [packetName, parameters] = utils.identifyPacket(this._command.answer, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }
        let data
        if (packetName === '') {
            data = parameters
        } else {
            data = packetName
        }

        this._setState(RequestStates.COMPLETED, data)
        return true
    }

    get answer () {
        return this.promiseState(RequestStates.COMPLETED)
    }
}

class ViscaDeviceSettingCommand extends Request {
    
    static get type () { return [0x01, 0x20] }
    
    constructor(command, parameters) {
        super(command, parameters)
        
        this._stateMap[RequestStates.SENT].parseFunction = this.parseAnswer.bind(this)
    }

    parseAnswer (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address']}
        let [packetName, parameters] = utils.identifyPacket(this._command.answer, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }

        this._setState(RequestStates.COMPLETED, [packetName, parameters])
        return true
    }

    promiseAnswer (answerName) {
        return this.promiseState(RequestStates.COMPLETED).then((data) => { 
            return new Promise((resolve, reject) => {
                if (data[0] === answerName) { 
                    resolve(data[0])
                } else {
                    reject(data)
                }
            })
        })
    }
}

module.exports = {
    ViscaCommand: ViscaCommand,
    ViscaInquery: ViscaInquiry,
    ViscaDeviceSettingCommand: ViscaDeviceSettingCommand, 
}