import test from 'node:test'
import assert from 'node:assert'
import { Range, List, HexLiteral, IPv4, AsciiString, ParameterGroup } from '../lib/Parameters.js'
import * as utils from '../lib/utils.js'
import * as lut from '../lib/Marshall/lookupTables.js'

const memoryNumber = new ParameterGroup(new Range('Memory Number', 0, 255), {
	nHex: 3,
	encoder: (parameterDict) => [
		...utils.uintToHexArray(Math.floor(parameterDict['Memory Number'] / 128), 1),
		...utils.uintToHexArray(parameterDict['Memory Number'] % 128, 2),
	],
	decoder: (hexArray) => ({
		'Memory Number': utils.hexArrayToUint(hexArray.slice(0, 1)) * 128 + utils.hexArrayToUint(hexArray.slice(1)),
	}),
})

const cases = [
	[
		new List('Power Mode', Object.keys(lut.powerModeArray)).newGroup(lut.powerModeArray, 2),
		{ 'Power Mode': 'Off (Standby)' },
		[0x0, 0x3],
	],
	[
		new List('Iris Position', Object.keys(lut.irisPositionArray)).newGroup(lut.irisPositionArray),
		{ 'Iris Position': 'Close' },
		[0xf],
	],
	[
		new List('Resolution', Object.keys(lut.resolutionArray)).newGroup(lut.resolutionArray),
		{ Resolution: 'HD 720P(1280 x 720) - 29.97p' },
		[0x1, 0x1],
	],
	[new Range('Speed', 0, 7).newGroup(), { Speed: 4 }, [0x4]],
	[new Range('Zoom Position', 0x0000, 0x4000).newGroup(), { 'Zoom Position': 0x3400 }, [0x3, 0x4, 0x0, 0x0]],
	[new Range('Focus Position', 0x0000, 0x047a).newGroup(4), { 'Focus Position': 0x0400 }, [0x0, 0x4, 0x0, 0x0]],
	[new Range('Socket', 1, 2).newGroup(), { Socket: 2 }, [0x2]],
	[new HexLiteral('Model ID', 4).newGroup(), { 'Model ID': '0513' }, [0x0, 0x5, 0x1, 0x3]],
	[new Range('Maximum Socket', 0x01, 0xff).newGroup(), { 'Maximum Socket': 2 }, [0x0, 0x2]],
	[
		new AsciiString('Firmware Version Type', 3).newGroup(),
		{ 'Firmware Version Type': 'VBO' },
		[0x5, 0x6, 0x4, 0x2, 0x4, 0xf],
	],
	[
		new IPv4('IP Address v4').newGroup(),
		{ 'IP Address v4': '192.168.102.33' },
		[0xc, 0x0, 0xa, 0x8, 0x6, 0x6, 0x2, 0x1],
	],
	[memoryNumber, { 'Memory Number': 139 }, [0x1, 0x0, 0xb]],
]

for (const [parameterGroup, parameterDict, hexArray] of cases) {
	const name = parameterGroup.parameterArray[0].name
	test(`${name} encodes and decodes`, () => {
		assert.deepStrictEqual(parameterGroup.encoder(parameterDict), hexArray)
		assert.deepStrictEqual(parameterGroup.decoder(hexArray), parameterDict)
	})
}

test('encoder rejects values out of range', () => {
	const group = new Range('Speed', 0, 7).newGroup()
	assert.throws(() => group.encoder({ Speed: 8 }), /invalid/)
	assert.throws(() => group.encoder({}), /not found/)
})

test('decoder rejects hex arrays of wrong length', () => {
	const group = new Range('Zoom Position', 0x0000, 0x4000).newGroup()
	assert.throws(() => group.decoder([0x1, 0x2]), /length/)
})

test('hexArrayToByteArray does not modify its input', () => {
	const hexArray = [0x1, 0x2, 0x3]
	assert.deepStrictEqual(utils.hexArrayToByteArray(hexArray), [0x01, 0x23])
	assert.deepStrictEqual(hexArray, [0x1, 0x2, 0x3])
})
