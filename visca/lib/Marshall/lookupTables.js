exports.nSockets = 2

exports.irisPositionArray = {
    'Close': 0x0F,
    'F1.6':  0x0E,
    'F2':    0x0D,
    'F2.2':  0x0C,
    'F2.7':  0x0B,
    'F3.2':  0x0A,
    'F3.8':  0x09,
    'F4.5':  0x08,
    'F5.4':  0x07,
    'F6.3':  0x06,
    'F7.8':  0x05,
    'F9':    0x04,
    'F11':   0x03,
    'F13':   0x02,
    'F16':   0x01,
    'F18':   0x00   
}

exports.powerModeArray = {
    'On':            0x02,
    'Off (Standby)': 0x03
}

exports.defaultOnOffArray = {
    'On':            0x02,
    'Off (Standby)': 0x03
}

exports.focusModeArray = {
    'Auto Focus':   0x02,
    'Manual Focus': 0x03
}

exports.curveTrackingArray = {
    'Curve tracking': 0x02,
    'Zoom tracking':  0x03
}

exports.autofocusSensitivtyArray = {
    'High':   0x01,
    'Middle': 0x02,
    'Low':    0x03
}

exports.autofocusFrameArray = {
    'Auto':       0x01,
    'Full Frame': 0x02,
    'Center':     0x03
}

exports.resolutionArray = {
    'QFHD 4K(3840 x 2160) - 29.97p':   0x05,
    'QFHD 4K(3840 x 2160) - 25p':      0x06,
    'FHD 1080P(1920 x 1080) - 59.94p': 0x08,
    'FHD 1080P(1920 x 1080) - 50p':    0x09,
    'FHD 1080P(1920 x 1080) - 29.97p': 0x0B,
    'FHD 1080P(1920 x 1080) - 25p':    0x0C,
    'HD 720P(1280 x 720) - 59.94p':    0x0E,
    'HD 720P(1280 x 720) - 50p':       0x0F,
    'HD 720P(1280 x 720) - 29.97p':    0x11,
    'HD 720P(1280 x 720) - 25p':       0x12
}

exports.hdmiOutputRangeArray = {
    '16~235': 0x01,
    '1~254':  0x02
}

exports.whiteBalanceModeArray = {
    'Auto':         0x00,
    'Indoor':       0x01,
    'Outdoor':      0x02,
    'One Push':     0x03,
    'Auto Tracing': 0x04,
    'Manual':       0x05,
    'Sodium Lamp':  0x0C
}