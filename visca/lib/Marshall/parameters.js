import { Range, List } from '../Parameters.js'
import * as lut from './lookupTables.js'

export const addressParameter = new Range('Address', 1, 7)
export const socket = new Range('Socket', 1, lut.nSockets)

export const powerMode = new List('Power Mode', Object.keys(lut.powerModeArray))
export const zoomAndFocusSpeed = new Range('Speed', 0, 7, '0 (Low) to 7 (High)')
export const zoomPosition = new Range('Zoom Position', 0x0000, 0x4000, `${0x0000} (Wide end) to ${0x4000} (Tele end)`)
export const zoomMemoryMode = new List('Zoom Memory Mode', Object.keys(lut.defaultOnOffArray))
export const focusPosition = new Range('Focus Position', 0x0000, 0x047a, `${0x0000} to ${0x047a}`)
export const focusMode = new List('Focus Mode', Object.keys(lut.focusModeArray))
export const curveTracking = new List('Curve Tracking', Object.keys(lut.curveTrackingArray))
export const autofocusSensitivity = new List('Autofocus Sensitivity', Object.keys(lut.autofocusSensitivityArray))
export const autofocusFrame = new List('Autofocus Frame', Object.keys(lut.autofocusFrameArray))
export const resolution = new List('Resolution', Object.keys(lut.resolutionArray))
export const hdmiOutputRange = new List('HDMI Output Range', Object.keys(lut.hdmiOutputRangeArray))
export const whiteBalanceMode = new List('White Balance Mode', Object.keys(lut.whiteBalanceModeArray))
export const whiteBalanceRedGain = new Range('White Balance Red Gain', 0x00, 0x80, `${0x00} to ${0x80}`)
export const whiteBalanceBlueGain = new Range('White Balance Blue Gain', 0x00, 0x80, `${0x00} to ${0x80}`)

export const irisPosition = new List('Iris Position', Object.keys(lut.irisPositionArray))
export const panSpeed = new Range('Pan Speed', 0x01, 0x18, `${0x01} (Low) to ${0x18} (High)`)
export const tiltSpeed = new Range('Tilt Speed', 0x01, 0x14, `${0x01} (Low) to ${0x14} (High)`)
export const panTiltDirection = new List('Direction', Object.keys(lut.panTiltDirectionArray))
export const presetNumber = new Range('Preset', 0, 127, `0 to 127`)
