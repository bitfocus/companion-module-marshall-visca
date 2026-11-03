import { Packet } from './Packets.js'

const RequestStates = Object.freeze({
	PENDING: 0,
	SENDING: 1,
	SENT: 2,
	ACK: 3,
	COMPLETED: 4,
	ERROR: -1,
})

const StateTransition = Object.freeze({
	[Packet.TYPES.ERROR]: RequestStates.ERROR,
	[Packet.TYPES.ACK]: RequestStates.ACK,
	[Packet.TYPES.COMPLETION]: RequestStates.COMPLETED,
	[Packet.TYPES.ANSWER]: RequestStates.COMPLETED,
})

class Request {
	static get STATES() {
		return RequestStates
	}

	/**
	 *
	 * @param {Command} command
	 * @param {Object} parameterDict
	 */
	constructor(command, parameterDict = {}) {
		if (command === undefined) {
			throw new Error('No command specified to create request')
		}
		this.command = command
		this.parameterDict = parameterDict

		this._stateMap = new Map()
		for (const [name, value] of Object.entries(RequestStates)) {
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

		this._setState(RequestStates.PENDING)
	}

	get completion() {
		return this._stateMap.get(RequestStates.COMPLETED).promise
	}

	get state() {
		return this._state
	}

	_getCurrentStateObject() {
		return this._stateMap.get(this._state)
	}

	confirmSent() {
		this._setState(RequestStates.SENT)
	}

	getFinalPayload() {
		const payload = this.command.pattern.writePayload(this.parameterDict)
		this._setState(RequestStates.SENDING)
		return payload
	}

	identifyRecievedPayload(payload) {
		for (const reply of this.command.replies) {
			try {
				const parameterDict = reply.pattern.readPayload(payload)
				return { packet: reply, parameterDict }
			} catch (error) {}
		}
	}

	receiveReply(payload) {
		const expectedType = this._getCurrentStateObject().expectedType
		if (expectedType === undefined) {
			throw Error(`Did not expect incoming message in message state '${this._getCurrentStateObject().name}'`)
		}

		const identifiedReply = this.identifyRecievedPayload(payload)

		if (identifiedReply === undefined) {
			throw Error(`Could not understand message: ${Buffer.from(payload).toString('hex').toUpperCase()}`)
		}

		if (identifiedReply.packet.type === Packet.TYPES.ERROR) {
			this._setState(RequestStates.ERROR, identifiedReply)
		} else {
			// A reply can skip expected states (e.g. completion without ack), _setState resolves the skipped ones
			this._setState(StateTransition[identifiedReply.packet.type], identifiedReply)
		}
	}

	/**
	 * Sets the request to the error state, unless it is already finished.
	 *
	 * @param {*} reason  Reason passed to the rejected promises.
	 */
	fail(reason) {
		if (this._state === RequestStates.ERROR || this._state === RequestStates.COMPLETED) {
			return
		}
		this._setState(RequestStates.ERROR, reason)
	}

	_setState(newState, data) {
		const oldState = this._state
		if (oldState === RequestStates.ERROR) {
			throw new Error('Cannot change state, because the current state is error')
		}
		if (newState !== RequestStates.ERROR && oldState >= newState) {
			throw new Error(`Cannot change state, because the current state is ${oldState}`)
		}
		this._state = newState

		if (newState === RequestStates.ERROR) {
			this._stateMap.get(newState).receive(data)
			for (let stateNumber = oldState + 1; stateNumber <= RequestStates.COMPLETED; stateNumber++) {
				this._stateMap.get(stateNumber).reject(data)
			}
		} else {
			for (let stateNumber = oldState + 1; stateNumber < newState; stateNumber++) {
				this._stateMap.get(stateNumber).receive()
			}
			this._stateMap.get(newState).receive(data)
			if (newState === RequestStates.COMPLETED) {
				this._stateMap.get(RequestStates.ERROR).reject(data)
			}
		}
	}
}

class ActionRequest extends Request {
	constructor(command, parameterDict) {
		super(command, parameterDict)

		this._stateMap.get(RequestStates.SENT).expectedType = Packet.TYPES.ACK
		this._stateMap.get(RequestStates.ACK).expectedType = Packet.TYPES.COMPLETION
	}

	get ack() {
		return this._stateMap.get(RequestStates.ACK).promise
	}
}

class InquiryRequest extends Request {
	constructor(command, parameterDict) {
		super(command, parameterDict)

		this._stateMap.get(RequestStates.SENT).expectedType = Packet.TYPES.ANSWER
	}

	/**
	 * Resolves with the parameters of the answer, without the address.
	 */
	get answer() {
		return this.completion.then(({ parameterDict }) => {
			const { Address: _address, ...answer } = parameterDict
			return answer
		})
	}
}

export { Request, ActionRequest, InquiryRequest }
