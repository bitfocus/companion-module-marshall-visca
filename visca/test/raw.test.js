import test from 'node:test'
import assert from 'node:assert'
import dgram from 'node:dgram'
import net from 'node:net'
import MarshallCamera, { Protocols } from '../lib/Marshall/MarshallCamera.js'
import commands, { inquiries } from '../lib/Marshall/commands.js'

const reply = (message) =>
	message[1] === 0x09
		? [0x90, 0x50, 0x02, 0xff] // every inquiry is answered with 'On'
		: [0x90, 0x41, 0xff, 0x90, 0x51, 0xff] // ack and completion in one chunk

function startRawTcpCamera() {
	const received = []
	const server = net.createServer((socket) => {
		socket.on('data', (data) => {
			received.push([...data])
			// Split the reply to test reassembly of partial messages
			const bytes = Buffer.from(reply(data))
			socket.write(bytes.subarray(0, 2))
			setTimeout(() => socket.write(bytes.subarray(2)), 5)
		})
	})
	return new Promise((resolve) =>
		server.listen(0, '127.0.0.1', () => resolve({ server, received, port: server.address().port })),
	)
}

test('raw VISCA over TCP sends commands and inquiries one after another', async () => {
	const { server, received, port } = await startRawTcpCamera()
	const camera = new MarshallCamera('127.0.0.1', { port, protocol: Protocols.RAW_TCP })
	try {
		await camera.connect()
		const command = camera.sendCommand(commands['zoom/stop'], {})
		const inquiry = camera.sendInquiry(inquiries['power'])
		await command.completion
		assert.deepStrictEqual(await inquiry.answer, { 'Power Mode': 'On' })
		assert.deepStrictEqual(received, [
			[0x81, 0x01, 0x04, 0x07, 0x00, 0xff],
			[0x81, 0x09, 0x04, 0x00, 0xff],
		])
	} finally {
		camera.close()
		server.close()
	}
})

test('raw VISCA over TCP fails fast when not connected', async () => {
	const { server, port } = await startRawTcpCamera()
	server.close()
	const camera = new MarshallCamera('127.0.0.1', { port, protocol: Protocols.RAW_TCP })
	camera.on('error', () => {})
	try {
		await assert.rejects(camera.sendCommand(commands['zoom/stop'], {}).completion, /Not connected/)
		await assert.rejects(camera.connect(), /Could not connect/)
	} finally {
		camera.close()
	}
})

test('raw VISCA over UDP', async () => {
	const server = dgram.createSocket('udp4')
	server.on('message', (msg, rinfo) => server.send(Buffer.from(reply(msg)), rinfo.port, rinfo.address))
	await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve))
	const camera = new MarshallCamera('127.0.0.1', { port: server.address().port, protocol: Protocols.RAW_UDP })
	try {
		await camera.connect()
		await camera.sendCommand(commands['power'], { 'Power Mode': 'On' }).completion
		assert.deepStrictEqual(await camera.sendInquiry(inquiries['power']).answer, { 'Power Mode': 'On' })
	} finally {
		camera.close()
		server.close()
	}
})
