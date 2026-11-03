import test from 'node:test'
import assert from 'node:assert'
import { Match, Pattern } from '../lib/Packets.js'
import { Range, ParameterGroup } from '../lib/Parameters.js'
import commands from '../lib/Marshall/commands.js'

const senderAddress = new ParameterGroup(new Range('Address', 1, 7), {
    nHex: 1,
    encoder: parameterDict => [ parameterDict['Address'] + 8 ],
    decoder: hexArray => ({ 'Address': hexArray[0] - 8 })
})

test('pattern writes and reads payloads', () => {
    const pattern = new Pattern('8x 10 42', [ new Match('x', senderAddress) ])
    assert.deepStrictEqual(pattern.writePayload({ 'Address': 2 }), [0x8A, 0x10, 0x42])
    assert.deepStrictEqual(pattern.readPayload([0x8A, 0x10, 0x42]), { 'Address': 2 })
    assert.throws(() => pattern.readPayload([0x8A, 0x11, 0x42]), /does not match/)
})

const payloads = [
    ['power', { 'Power Mode': 'On' }, '81 01 04 00 02 FF'],
    ['zoom/stop', {}, '81 01 04 07 00 FF'],
    ['zoom/tele/variable', { 'Speed': 5 }, '81 01 04 07 25 FF'],
    ['zoom/direct', { 'Zoom Position': 0x1234 }, '81 01 04 47 01 02 03 04 FF'],
    ['focus/direct', { 'Focus Position': 234 }, '81 01 04 48 00 00 0E 0A FF'],
    ['focus/mode', { 'Focus Mode': 'Manual Focus' }, '81 01 04 38 03 FF'],
    ['resolution', { 'Resolution': 'FHD 1080P(1920 x 1080) - 59.94p' }, '81 01 06 35 00 08 FF'],
    ['whiteBalance/redGain/direct', { 'White Balance Red Gain': 0x40 }, '81 01 04 43 00 00 04 00 FF'],
]

for (const [key, parameterDict, expected] of payloads) {
    test(`command ${key} creates the expected payload`, () => {
        const command = commands[key]
        assert.ok(command, `command ${key} exists`)
        const payload = command.pattern.writePayload({ 'Address': 1, ...parameterDict })
        assert.strictEqual(Buffer.from(payload).toString('hex').toUpperCase().match(/../g).join(' '), expected)
    })
}

test('replies of tasks are identified', () => {
    const command = commands['power']
    const identify = payload => command.replies.find(reply => {
        try { reply.pattern.readPayload(payload); return true } catch { return false }
    })?.name
    assert.strictEqual(identify([0x90, 0x41, 0xFF]), 'Ack')
    assert.strictEqual(identify([0x90, 0x51, 0xFF]), 'Completion')
    assert.strictEqual(identify([0x90, 0x61, 0x41, 0xFF]), 'Command not executable')
    assert.strictEqual(identify([0x90, 0x60, 0x02, 0xFF]), 'Syntax Error')
})

test('every command has unique parameter names', () => {
    for (const [key, command] of Object.entries(commands)) {
        const names = [...command.pattern.getParameters()].map(parameter => parameter.name)
        assert.strictEqual(new Set(names).size, names.length, key)
    }
})
