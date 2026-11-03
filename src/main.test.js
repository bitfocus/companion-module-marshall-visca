import test from 'node:test'
import assert from 'node:assert'
import dgram from 'node:dgram'
import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus } from '@companion-module/base'
import MarshallViscaInstance from './main.js'

const INQUIRY_ANSWERS = {
	'81090400ff': [0x90, 0x50, 0x02, 0xff],
	'81090612ff': [0x90, 0x50, 0x0f, 0x0f, 0x0f, 0x0e, 0x00, 0x00, 0x01, 0x00, 0xff],
	'81090002ff': [0x90, 0x50, 0x00, 0x01, 0x05, 0x13, 0x01, 0x04, 0x02, 0xff],
	'8109044bff': [0x90, 0x50, 0x00, 0x00, 0x00, 0x09, 0xff],
	'81090433ff': [0x90, 0x50, 0x02, 0xff],
	// Undocumented value reported by a Marshall camera
	'81090438ff': [0x90, 0x50, 0x04, 0xff],
	// Not executable, e.g. in standby
	'81090447ff': [0x90, 0x60, 0x41, 0xff],
}

/**
 * @param {object} [options]
 * @param {boolean} [options.latestSequenceNumber]  Stamp replies with the sequence number received last
 *   and answer with a delay, like the Marshall camera from the field test.
 */
async function startFakeCamera({ latestSequenceNumber = false } = {}) {
	const server = dgram.createSocket('udp4')
	const received = []
	let latest = Buffer.alloc(4)
	server.on('message', (msg, rinfo) => {
		received.push(msg.toString('hex'))
		latest = msg.subarray(4, 8)
		const send = (type, payload) =>
			server.send(
				Buffer.from([
					...type,
					0x00,
					payload.length,
					...(latestSequenceNumber ? latest : msg.subarray(4, 8)),
					...payload,
				]),
				rinfo.port,
				rinfo.address,
			)
		const reply = (type, payload) =>
			latestSequenceNumber ? setTimeout(() => send(type, payload), 3) : send(type, payload)
		if (msg[0] === 0x02) {
			reply([0x02, 0x01], [0x01])
		} else if (msg[1] === 0x10) {
			// Unknown inquiries are answered with a syntax error, like an unsupported command
			reply([0x01, 0x11], INQUIRY_ANSWERS[msg.subarray(8).toString('hex')] ?? [0x90, 0x60, 0x02, 0xff])
		} else {
			reply([0x01, 0x11], [0x90, 0x41, 0xff])
			reply([0x01, 0x11], [0x90, 0x51, 0xff])
		}
	})
	await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve))
	return { server, received, port: server.address().port }
}

function createInstance() {
	const host = { statuses: [], actions: undefined, feedbacks: undefined, variables: {}, checkedFeedbacks: new Set() }
	const context = {
		_isInstanceContext: true,
		id: 'test',
		label: 'test',
		upgradeScripts: [],
		saveConfig: () => {},
		setActionDefinitions: (actions) => (host.actions = actions),
		setFeedbackDefinitions: (feedbacks) => (host.feedbacks = feedbacks),
		setVariableDefinitions: () => {},
		setPresetDefinitions: (structure, presets) => Object.assign(host, { structure, presets }),
		setVariableValues: (values) => Object.assign(host.variables, values),
		checkFeedbacks: (ids) => ids.forEach((id) => host.checkedFeedbacks.add(id)),
		updateStatus: (status, message) => host.statuses.push([status, message]),
	}
	return { instance: new MarshallViscaInstance(context), host }
}

const isCommand = (message) => message.startsWith('0100')

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
		await instance.init({ host: '127.0.0.1', port, poll_interval: 0 })
		await sleep(50)
		assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.Ok)

		await host.actions.pan_tilt_drive.callback({ options: { pan_speed: 24, tilt_speed: 20, direction: 'Right' } })
		await host.actions.preset_recall.callback({ options: { preset: 3 } })
		await sleep(50)
		assert.deepStrictEqual(received.filter(isCommand), [
			'01000009000000028101060118140203ff',
			'01000007000000038101043f0203ff',
		])
		assert.strictEqual(host.variables.last_preset, 3)
		assert.strictEqual(host.feedbacks.preset_active.callback({ options: { preset: 3 } }), true)
	} finally {
		await instance.destroy()
		server.close()
	}
})

test('polls the status into variables and feedbacks', async () => {
	const { server, received, port } = await startFakeCamera()
	const { instance, host } = createInstance()
	try {
		await instance.init({ host: '127.0.0.1', port, poll_interval: 0.1 })
		await sleep(400)
		assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.Ok)
		assert.strictEqual(host.variables.power, 'On')
		assert.strictEqual(host.variables.pan_position, -2)
		assert.strictEqual(host.variables.tilt_position, 0x10)
		assert.strictEqual(host.variables.model_id, '0513')
		assert.ok(host.checkedFeedbacks.has('power_on'))
		assert.strictEqual(host.feedbacks.power_on.callback({ options: {} }), true)

		assert.strictEqual(host.variables.focus_mode, 'Unknown (0x04)')
		assert.strictEqual(host.variables.iris_position, 9)
		assert.strictEqual(host.variables.iris, 'F3.8')
		assert.strictEqual(host.variables.backlight, 'On')
		assert.strictEqual(host.feedbacks.setting_on.callback({ options: { setting: 'backlight' } }), true)
		assert.strictEqual(host.feedbacks.setting_on.callback({ options: { setting: 'wdr' } }), false)

		// Unsupported inquiries are only sent once
		const count = (inquiry) => received.filter((message) => message.endsWith(inquiry)).length
		assert.strictEqual(count('81090435ff'), 1)
		assert.ok(count('81090447ff') > 1, 'not executable inquiries are polled again')
		assert.ok(count('81090400ff') > 1)
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

test('resolves hostnames', async () => {
	const { server, port } = await startFakeCamera()
	const { instance, host } = createInstance()
	try {
		await instance.init({ host: 'localhost', port, poll_interval: 0 })
		await sleep(100)
		assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.Ok)
	} finally {
		await instance.destroy()
		server.close()
	}
})

test('reports bad config for invalid hosts', async () => {
	const { instance, host } = createInstance()
	await instance.init({ host: 'not a host!', port: 52381 })
	assert.strictEqual(host.statuses.at(-1)[0], InstanceStatus.BadConfig)
	await instance.destroy()
})

test('stays connected with a camera that reuses the latest sequence number', async () => {
	const { server, port } = await startFakeCamera({ latestSequenceNumber: true })
	const { instance, host } = createInstance()
	try {
		await instance.init({ host: '127.0.0.1', port, poll_interval: 0.1 })
		await sleep(600)
		assert.deepStrictEqual(
			host.statuses.filter(([status]) => status === InstanceStatus.ConnectionFailure),
			[],
		)
		assert.strictEqual(host.variables.power, 'On')
		assert.strictEqual(host.variables.model_id, '0513')
		assert.strictEqual(host.variables.pan_position, -2)
	} finally {
		await instance.destroy()
		server.close()
	}
})
