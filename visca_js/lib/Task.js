const { Packet } = require('./Packets')

const TaskStates = Object.freeze({
    PENDING: 0,
    SENDING: 1,
    SENT: 2,
    ACK: 3,
    COMPLETED: 4,
    ERROR: -1
})

const StateTransition = Object.freeze({
    [Packet.TYPES.ERROR]: TaskStates.ERROR,
    [Packet.TYPES.ACK]: TaskStates.ACK,
    [Packet.TYPES.COMPLETION]: TaskStates.COMPLETED,
    [Packet.TYPES.ANSWER]: TaskStates.COMPLETED,
})

class Task {
    static get STATES() {
        return TaskStates
    }
    
    /**
     * 
     * @param {Command} command 
     * @param {Object} parameterDict 
     */
    constructor(command, parameterDict) {
        this.command = command
        this.parameterDict = parameterDict
        
        this._stateMap = new Map()
        for (const [name, value] of Object.entries(TaskStates)) {
            let receive, reject
            const promise = new Promise((_receive, _reject) => {
                receive = _receive
                reject = _reject
            })
            promise.catch(() => {})
            this._stateMap.set(value, {
                name,
                promise,
                receive,
                reject,
                expectedType: undefined,
            })
        }

        this._setState(TaskStates.PENDING)
    }

    get state() {
        return this._state;
    }

    _getCurrentStateObject() {
        return this._stateMap.get(this._state)
    }

    confirmSent() {
        this._setState(TaskStates.SENT)
    }

    getFinalPayload() {
        const payload = this.command.pattern.writePayload(this.parameterDict)
        this._setState(TaskStates.SENDING)
        return payload
    }

    identifyRecievedPayload(payload) {
        for (const reply of this.command.replies) {
            try {
                const parameterDict = reply.pattern.readPayload(payload)
                return { packet: reply, parameterDict }
            } catch (error) { }
        }
    }

    receiveReply(payload) {
        console.log('Payload', Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' '))
        
        const expectedType = this._getCurrentStateObject().expectedType
        if (expectedType === undefined) {
            throw Error(`Did not expect incomming message in message state '${this.stateObject.name}'`)
        }

        const identifiedReply = this.identifyRecievedPayload(payload)

        console.log('Identified Reply', identifiedReply)

        if (identifiedReply === undefined) {
            throw Error('Could not understand message')
        }
        
        if (identifiedReply.packet.type === Packet.TYPES.ERROR) {
            this._setState(TaskStates.ERROR, identifiedReply)
        } else {
            if (identifiedReply.packet.type !== expectedType) {
                console.error('some error')
            }
            this._setState(StateTransition[identifiedReply.packet.type], identifiedReply)
        }
    }

    _setState(newState, data) {
        const oldState = this._state
        if (oldState === TaskStates.ERROR) {
            throw new Error('Cannot change state, because the current state is error')
        }
        if (newState !== TaskStates.ERROR && oldState >= newState) {
            throw new Error(`Cannot change state, because the current state is ${oldState}`)
        }
        this._state = newState
        
        if (newState === TaskStates.ERROR) {
            this._stateMap.get(newState).receive(data)
            for (let stateNumber = oldState + 1; stateNumber <= TaskStates.COMPLETED; stateNumber++) {
                this._stateMap.get(stateNumber).reject(data)
            }
        } else {
            for (let stateNumber = oldState + 1; stateNumber < newState; stateNumber++) {
                this._stateMap.get(stateNumber).receive()
            }
            this._stateMap.get(newState).receive(data)
            if (newState === TaskStates.COMPLETED) {
                this._stateMap.get(TaskStates.ERROR).reject(data)
            }
        }
    }
}

class ActionTask extends Task {
    constructor(command, parameterDict) {
        super(command, parameterDict)
        
        this._stateMap.get(TaskStates.SENT).expectedType = Packet.TYPES.ACK
        this._stateMap.get(TaskStates.ACK).expectedType = Packet.TYPES.COMPLETION
    }

    get ack() {
        return this._stateMap.get(TaskStates.ACK).promise
    }

    get completion() {
        return this._stateMap.get(TaskStates.COMPLETED).promise
    }
}

module.exports = {
    Task,
    ViscaCommand: ActionTask
}