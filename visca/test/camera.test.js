import test from 'node:test'
import assert from 'node:assert'
import dgram from 'node:dgram'
import MarshallCamera from '../lib/Marshall/MarshallCamera.js'
import commands, { inquiries } from '../lib/Marshall/commands.js'

/**
 * Minimal VISCA over IP camera: answers the sequence reset and replies to
 * every command with ack + completion (or the given error payload).
 */
function startFakeCamera({ errorPayload, answerPayload, silent = false } = {}) {
	const server = dgram.createSocket('udp4')
	const received = []
	server.on('message', (msg, rinfo) => {
		received.push([...msg])
		if (silent) {
			return
		}
		const header = (type, payload) => Buffer.from([...type, 0x00, payload.length, ...msg.subarray(4, 8), ...payload])
		const reply = (data) => server.send(data, rinfo.port, rinfo.address)
		if (msg[0] === 0x02 && msg[1] === 0x00) {
			reply(header([0x02, 0x01], [0x01]))
		} else if (msg[1] === 0x10) {
			reply(header([0x01, 0x11], answerPayload))
		} else if (errorPayload) {
			reply(header([0x01, 0x11], errorPayload))
		} else {
			reply(header([0x01, 0x11], [0x90, 0x41, 0xff]))
			reply(header([0x01, 0x11], [0x90, 0x51, 0xff]))
		}
	})
	return new Promise((resolve) =>
		server.bind(0, '127.0.0.1', () => resolve({ server, received, port: server.address().port })),
	)
}

test('sends a command and resolves ack and completion', async () => {
	const { server, received, port } = await startFakeCamera()
	const camera = new MarshallCamera('127.0.0.1', { port })
	try {
		const request = camera.sendCommand(commands['power'], { 'Power Mode': 'On' })
		await request.ack
		await request.completion
		assert.deepStrictEqual(received[0], [0x02, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x01])
		assert.deepStrictEqual(
			received[1],
			[0x01, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x81, 0x01, 0x04, 0x00, 0x02, 0xff],
		)
	} finally {
		camera.close()
		server.close()
	}
})

test('increments the sequence number', async () => {
	const { server, received, port } = await startFakeCamera()
	const camera = new MarshallCamera('127.0.0.1', { port })
	try {
		await camera.sendCommand(commands['zoom/stop'], {}).completion
		await camera.sendCommand(commands['zoom/stop'], {}).completion
		assert.deepStrictEqual(
			received.map((message) => message[7]),
			[0, 1, 2],
		)
	} finally {
		camera.close()
		server.close()
	}
})

test('rejects on a VISCA error reply', async () => {
	const { server, port } = await startFakeCamera({ errorPayload: [0x90, 0x61, 0x41, 0xff] })
	const camera = new MarshallCamera('127.0.0.1', { port })
	try {
		await assert.rejects(camera.sendCommand(commands['power'], { 'Power Mode': 'On' }).completion)
	} finally {
		camera.close()
		server.close()
	}
})

test('rejects when the camera does not answer and recovers afterwards', async () => {
	const fake = await startFakeCamera({ silent: true })
	const camera = new MarshallCamera('127.0.0.1', { port: fake.port })
	try {
		await assert.rejects(camera.sendCommand(commands['zoom/stop'], {}).completion, /sequence number reset/)
		fake.server.removeAllListeners('message')
		fake.server.close()

		const { server, port } = await startFakeCamera()
		camera.connection.port = port
		await camera.sendCommand(commands['zoom/stop'], {}).completion
		server.close()
	} finally {
		camera.close()
	}
})

test('rejects queued commands on close', async () => {
	const { server, port } = await startFakeCamera({ silent: true })
	const camera = new MarshallCamera('127.0.0.1', { port })
	const requests = [1, 2, 3].map(() => camera.sendCommand(commands['zoom/stop'], {}))
	camera.close()
	server.close()
	for (const request of requests) {
		await assert.rejects(request.completion)
	}
})

test('connect resets the sequence number', async () => {
	const { server, received, port } = await startFakeCamera()
	const camera = new MarshallCamera('127.0.0.1', { port })
	try {
		await camera.connect()
		await camera.sendCommand(commands['zoom/stop'], {}).completion
		assert.deepStrictEqual(
			received.map((message) => message[7]),
			[0, 1],
		)
	} finally {
		camera.close()
		server.close()
	}
})

test('sends an inquiry and resolves the answer', async () => {
	const { server, received, port } = await startFakeCamera({ answerPayload: [0x90, 0x50, 0x03, 0xff] })
	const camera = new MarshallCamera('127.0.0.1', { port })
	try {
		const answer = await camera.sendInquiry(inquiries['power']).answer
		assert.deepStrictEqual(answer, { 'Power Mode': 'Off (Standby)' })
		assert.deepStrictEqual(received[1], [0x01, 0x10, 0x00, 0x05, 0x00, 0x00, 0x00, 0x01, 0x81, 0x09, 0x04, 0x00, 0xff])
	} finally {
		camera.close()
		server.close()
	}
})

test('fails an inquiry with an unknown answer right away', async () => {
	const { server, port } = await startFakeCamera({ answerPayload: [0x90, 0x50, 0x07, 0xff] })
	const camera = new MarshallCamera('127.0.0.1', { port })
	camera.on('error', () => {})
	try {
		await assert.rejects(camera.sendInquiry(inquiries['power']).answer, /Could not understand/)
	} finally {
		camera.close()
		server.close()
	}
})
