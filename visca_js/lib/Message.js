const utils = require('./utils')
const { Call, Packet } = require('./requestClasses')

class PendingMessage {
    static get states () {
        return {
            pending: 0,
            sending: 1,
            sent: 2,
            ack: 3,
            completed: 4,
            error: -1
        }
    }
    static get type() { return undefined } // Abstract
    static get expectedType() { return undefined } // Abstract

    constructor(payload=[]) {
        this._payload = payload;
        this._state = PendingMessage.states.pending;
    }

    startSending (releaseSocket) {
        this._state = PendingMessage.states.sending
    }

    wasSent () {
        this._state = PendingMessage.states.sent;
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

    get payload() {
        return this._payload;
    }

    set payload(value) {
        if (this.state !== PendingMessage.states.pending) {
            throw Error('Message already sent')
        }
        this._payload = value
    }

    receiveReply(payload) {
        // TODO Delete line
        console.log(`Payload: ${Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' ')}, name: ${(this._command || {name: []}).name.slice(-1)}, parameters: ${JSON.stringify(this._parameters)}`)
    }
}

class AbstractViscaMessage extends PendingMessage {
    // TODO Merge with PendingMessage?

    static get expectedType() { return [0x01, 0x11] }

    /**
     * 
     * @param {Call} call 
     * @param {Object} parameterDict 
     */
    constructor(call, parameterDict) {
        super()
        
        this.call = call
        this.parameterDict = parameterDict
        
        this._stateMap = {}
        for (const [name, value] of Object.entries(PendingMessage.states)) {
            this._stateMap[value] = {
                name: name,
                callbacks: [],
                data: undefined,
                parseFunction: undefined
            }
        }
    }

    get stateObject () {
        return this._stateMap[this.state]
    }

    get payload() {
        return this.call.pattern.writePayload(this.parameterDict)
    }

    set payload(value) {
        throw Error('Cannot set payload. Change parameters instead')
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
        super.receiveReply(payload)
        
        const parseFunction = this.stateObject.parseFunction
        if (parseFunction === undefined) {
            throw Error(`Did not expect incomming message in message state '${this.stateObject.name}'`)
        }

        const identifiedReply = this.identifyRecievedPayload(payload)

        if (identifiedReply === undefined) {
            throw Error('Could not understand message')
        }
        
        if (identifiedReply.type === Packet.types.ERROR) {
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
        this._setState(PendingMessage.states.error, errorMessage)
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
                this._stateMap[PendingMessage.states.error].callbacks.push(reject)
            }
        })
    }
}

class ViscaCommand extends AbstractViscaMessage {
    static get type () { return [0x01, 0x00] }
    
    constructor(call, parameterDict) {
        super(call, parameterDict)
        
        this._stateMap[PendingMessage.states.sent].parseFunction = this.parseAck.bind(this)
        this._stateMap[PendingMessage.states.ack].parseFunction = this.parseCompletion.bind(this)
    }

    startSending (releaseSocket) {
        let saveReleaseSocket = () => { try { releaseSocket() } catch (_) { }}
        this._stateMap[PendingMessage.states.completed].callbacks.push(saveReleaseSocket)
        this._stateMap[PendingMessage.states.error].callbacks.push(saveReleaseSocket)
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
        this._setState(PendingMessage.states.ack)
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
        
        this._setState(PendingMessage.states.completed)
        return true
   }

    get ack () {
        return this.promiseState(PendingMessage.states.ack)
    }

    get completion () {
        return this.promiseState(PendingMessage.states.completed)
    }
}

class ViscaInquiry extends AbstractViscaMessage {
    static get type () { return [0x01, 0x10] }
    
    constructor(command, parameters) {
        super(command, parameters)

        this._stateMap[PendingMessage.states.sent].parseFunction = this.parseAnswer.bind(this)
    }

    startSending (releaseSocket) {
        let saveReleaseSocket = () => { try { releaseSocket() } catch (_) { }}
        this._stateMap[PendingMessage.states.completed].callbacks.push(saveReleaseSocket)
        this._stateMap[PendingMessage.states.error].callbacks.push(saveReleaseSocket)
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

        this._setState(PendingMessage.states.completed, data)
        return true
    }

    get answer () {
        return this.promiseState(PendingMessage.states.completed)
    }
}

class ViscaDeviceSettingCommand extends AbstractViscaMessage {
    
    static get type () { return [0x01, 0x20] }
    
    constructor(command, parameters) {
        super(command, parameters)
        
        this._stateMap[PendingMessage.states.sent].parseFunction = this.parseAnswer.bind(this)
    }

    parseAnswer (payload) {
        let validatorArguments = {'Address': this.parameterDict['Address']}
        let [packetName, parameters] = utils.identifyPacket(this._command.answer, payload, validatorArguments)
        if (typeof packetName === 'undefined') {
            return false
        }

        this._setState(PendingMessage.states.completed, [packetName, parameters])
        return true
    }

    promiseAnswer (answerName) {
        return this.promiseState(PendingMessage.states.completed).then((data) => { 
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

class ControlCommand extends PendingMessage {
    // TODO Implement AbstractViscaMessage pattern

    static get type () { return [0x02, 0x00] }
    static get expectedType() { return [0x02, 0x01] }

    constructor(payload) {
        super(payload)
    }

    startSending (releaseSocket) {
        this._releaseSocket = () => { try { releaseSocket() } catch (_) { }}
        super.startSending(releaseSocket)
    }

    wasSent () {
        this._releaseSocket()
        super.wasSent()
    }
}

module.exports = {
    ViscaCommand: ViscaCommand,
    ViscaInquery: ViscaInquiry,
    ViscaDeviceSettingCommand: ViscaDeviceSettingCommand, 
    ControlCommand: ControlCommand
}