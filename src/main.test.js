import test from 'node:test'
import assert from 'node:assert'
import dgram from 'node:dgram'
import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus } from '@companion-module/base'
import MarshallViscaInstance from './main.js'

async function startFakeCamera() {
	const server = dgram.createSocket('udp4')
	const received = []
	server.on('message', (msg, rinfo) => {
		received.push(msg.toString('hex'))
		const reply = (type, payload) =>
			server.send(
				Buffer.from([...type, 0x00, payload.length, ...msg.subarray(4, 8), ...payload]),
				rinfo.port,
				rinfo.address,
			)
		if (msg[0] === 0x02) {
			reply([0x02, 0x01], [0x01])
		} else {
			reply([0x01, 0x11], [0x90, 0x41, 0xff])
			reply([0x01, 0x11], [0x90, 0x51, 0xff])
		}
	})
	await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve))
	return { server, received, port: server.address().port }
}

function createInstance() {
	const host = { statuses: [], actions: undefined }
	const context = {
		_isInstanceContext: true,
		id: 'test',
		label: 'test',
		upgradeScripts: [],
		saveConfig: () => {},
		setActionDefinitions: (actions) => (host.actions = actions),
		updateStatus: (status, message) => host.statuses.push([status, message]),
	}
	return { instance: new MarshallViscaInstance(context), host }
}

test('reports bad config without host', async () => {
	const { instance, host } = createInstance()
	await instance.init({ host: '', port: 52381 })
	assert.deepStrictEqual(host.statuses.at(-1)[0], InstanceStatus.BadConfig)
	await instance.destroy()
})

test('connects and sends actions to the camera', async () => {
	const { server, received, port } = await startFakeCamera()
	const { instance, host } = createInstance()
	try {
		await instance.init({ host: '127.0.0.1', port })
		await sleep(50)
		assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.Ok)

		await host.actions.pan_tilt_drive.callback({ options: { pan_speed: 24, tilt_speed: 20, direction: 'Right' } })
		await host.actions.preset_recall.callback({ options: { preset: 3 } })
		await sleep(50)
		assert.deepStrictEqual(received, [
			'020000010000000001',
			'01000009000000018101060118140203ff',
			'01000007000000028101043f0203ff',
		])
	} finally {
		await instance.destroy()
		server.close()
	}
})

test('reports a connection failure when the camera does not answer', async () => {
	const server = dgram.createSocket('udp4')
	await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve))
	const { instance, host } = createInstance()
	try {
		await instance.init({ host: '127.0.0.1', port: server.address().port })
		await sleep(1200)
		assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.ConnectionFailure)
	} finally {
		await instance.destroy()
		server.close()
	}
})
