const utils = require('./utils')
const ViscaController = require('./ViscaController')

const n_sockets = 2

const irisPositionList = {
    'Close': '0F',
    'F1.6': '0E',
    'F2': '0D',
    'F2.2': '0C',
    'F2.7': '0B',
    'F3.2': '0A',
    'F3.8': '09',
    'F4.5': '08',
    'F5.4': '07',
    'F6.3': '06',
    'F7.8': '05',
    'F9': '04',
    'F11': '03',
    'F13': '02',
    'F16': '01',
    'F18': '00',    
}
const resolutionList = {
    'QFHD 4K(3840 x 2160) - 29.97p': '05',
    'QFHD 4K(3840 x 2160) - 25p': '06',
    'FHD 1080P(1920 x 1080) - 59.94p': '08',
    'FHD 1080P(1920 x 1080) - 50p': '09',
    'FHD 1080P(1920 x 1080) - 29.97p': '0B',
    'FHD 1080P(1920 x 1080) - 25p': '0C',
    'HD 720P(1280 x 720) - 59.94p': '0E',
    'HD 720P(1280 x 720) - 50p': '0F',
    'HD 720P(1280 x 720) - 29.97p': '11',
    'HD 720P(1280 x 720) - 25p': '12',
}
const irisPosition = {
    parameters: {
        'Iris Position': {
            type: 'list',
            list: irisPositionList
        }
    },
    encoder: parameters => utils.uintToHexArray(irisPositionList[parameters['Iris Positon']], 2)
}
const resolution = {
    parameters: {
        'Resolution': {
            type: 'list',
            list: resolutionList
        }
    },
    encoder: parameters => utils.uintToHexArray(parseInt(resolutionList[parameters['Resolution']], 16), 2),
    decoder: markers => ({ 'Resolution': utils.getKeyByValue(resolutionList, utils.hexArrayToHexString(markers))})
}
const zoomAndFocusSpeed = {
    parameters: {
        'Speed': {
            type: 'range',
            min: 0,
            max: 7,
            comment: '0 (Low) to 7 (High)'
        }
    },
    encoder: parameters => [ parameters['Speed'] ]
}
const zoomPosition = {
    parameters: {
        'Zoom Position': {
            type: 'range',
            min: 0x0000,
            max: 0x4000,
            comment: `${0x0000} (Wide end) to ${0x4000} (Tele end)`
        }
    },
    encoder: parameters => utils.uintToHexArray(parameters['Zoom Positon'], 4),
    decoder: markers => ({ 'Zoom Position': utils.hexArrayToUint(markers) })
}
const focusPosition = {
    parameters: {
        'Focus Position': {
            type: 'range',
            min: 0x000,
            max: 0x47A,
            comment: `${0x000} (Wide end) to ${0x47A} (Tele end)`
        }
    },
    encoder: parameters => utils.uintToHexArray(parameters['Focus Positon'], 4),
    decoder: markers => ({ 'Focus Position': utils.hexArrayToUint(markers) })
}
const senderAddress = {
    parameters: {
        'Address': {
            type: 'range',
            min: 1,
            max: 7
        }
    },
    decoder: markers => ({ 'Address': markers[0] - 8 }),
    validator: (parameters, validatorArguments) => parameters['Address'] === validatorArguments['Address'],
    validatorArguments: ['Address']
}
const receiverAddress = {
    parameters: {
        'Address': {
            internal: true,
            type: 'range',
            min: 1,
            max: 7,
        }
    },
    encoder: parameters => [ parameters['Address'] ]
}
const socket = {
    parameters: {
        'Socket': {
            type: 'range',
            min: 1,
            max: n_sockets
        }
    },
    encoder: parameters => [ parameters['Socket'] ],
    decoder: markers => ({ 'Socket': markers[0] })
}
const specificSocket = {
    ...socket,
    validator: (parameters, validatorArguments) => parameters['Socket'] === validatorArguments['Socket'],
    validatorArguments: ['Socket']
}
const cameraModel = {
    parameters: {
        'Vendor ID': {
            type: 'hex',
            length: 4
        },
        'Model ID': {
            type: 'hex',
            length: 4
        }
    },
    decoder: markers => ({
        'Vendor ID': utils.byteArrayToHexString(markers.slice(0, 2), ''), 
        'Model ID': utils.byteArrayToHexString(markers.slice(2, 4), '')
    })
}
const romVersion = {
    parameters: {
        'Rom revision': {
            type: 'hex',
            length: 4
        }
    },
    decoder: markers => ({ 'Rom revision': utils.byteArrayToHexString(markers, '') })
}
const maximumSocket = {
    parameters: {
        'Maximum socket': {
            type: 'hex',
            length: 2
        }
    },
    decoder: markers => ({ 'Maximum socket': utils.byteArrayToHexString(markers, '') })
}
const powerPackets = {
    'On': {
        core: '02',
        comment: 'Power ON'
    },
    'Off (Standby)': {
        core: '03',
        comment: 'Power OFF'
    }
}
const zoomMemoryModePackets = {
    'On': {
        core: '02',
        comment: 'Zoom Memory Mode ON'
    },
    'Off': {
        core: '03',
        comment: 'Zoom Memory Mode OFF'
    }
}

const requestSet = {
    prefix: '8x',
    postfix: 'FF',
    markers: {
        'x': receiverAddress
    },
    answer: {
        prefix: 'X0',
        postfix: 'FF',
        markers: {
            'X': senderAddress,
        }
    },
    error: {
        prefix: 'X0',
        postfix: 'FF',
        markers: {
            'X': senderAddress,
        },
        packets: {
            'Syntax Error': '60 02',
            'Command buffer full': '60 03',
            'Command cancelled': {
                core: '6Y 04',
                markers: {
                    'Y': specificSocket
                }
            },
            'No socket (to be cancelled)': {
                core: '6Y 05',
                markers: {
                    'Y': specificSocket
                }
            }
        }
    },
    packets: {
        'command': {
            prefix: '01',
            answer: {
                packets: {
                    'Ack': '4Y',
                    'Completion': '5Y'
                },
                markers: {
                    'Y': socket
                }
            },
            error: {
                packets: {
                    'Command not executable': {
                        core: '6Y 41',
                        markers: {
                            'Y': specificSocket
                        }
                    }
                }
            },
            packets: {
                'CAM_Power': {
                    prefix: '04 00',
                    packets: powerPackets
                },
                'CAM_Zoom': {
                    prefix: '04',
                    packets: {
                        'Stop': '07 00',
                        'Tele (Standard)': '07 02',
                        'Wide (Standard)': '07 03',
                        'Tele Step': '07 04',
                        'Wide Step': '07 05',
                        'Tele (Variable)': {
                            core: '07 2p',
                            markers: {
                                'p': zoomAndFocusSpeed
                            }
                        },
                        'Wide (Variable)': {
                            core: '07 3p',
                            markers: {
                                'p': zoomAndFocusSpeed
                            }
                        },
                        'Zoom Memory Mode': {
                            prefix: '47 00',
                            packets: zoomMemoryModePackets
                        }
                    }
                },
                'CAM_Focus': {
                    prefix: '04',
                    packets: {
                        'Stop': {
                            core: '08 00',
                            comment: 'Enabled during Manual Focus Mode'
                        },
                        'Far (Standard)': {
                            core: '08 02',
                            comment: 'Enabled during Manual Focus Mode'
                        },
                        'Near (Standard)': {
                            core: '08 03',
                            comment: 'Enabled during Manual Focus Mode'
                        },
                        'Far Step': {
                            core: '08 04',
                            comment: 'Enabled during Manual Focus Mode'
                        },
                        'Near Step': {
                            core: '08 05',
                            comment: 'Enabled during Manual Focus Mode'
                        },
                        'Far (Variable)': {
                            core: '08 2p',
                            comment: 'Enabled during Manual Focus Mode',
                            markers: {
                                'p': zoomAndFocusSpeed
                            }
                        },
                        'Near (Variable)': {
                            core: '08 3p',
                            comment: 'Enabled during Manual Focus Mode',
                            markers: {
                                'p': zoomAndFocusSpeed
                            }
                        },
                        'Auto Focus': {
                            core: '38 02',
                            comment: 'Auto Focus ON'
                        },
                        'Manual Focus': {
                            core: '38 03',
                            comment: 'Auto Focus OFF'
                        },
                        'Auto/Manual Focus': {
                            core: '38 10',
                            comment: 'Auto Focus Toggle'
                        },
                        'One Push Trigger': {
                            core: '18 01',
                            comment: 'One Push Auto Focus Trigger\nEnabled during Manual Focus Mode',
                        }
                    }
                },
                'CAM_Curve': {
                    prefix: '04 38 03',
                    packets: {
                        'Curve tracking': {
                            core: 02,
                            comment: 'Curve tracking ON'
                        },
                        'Zoom tracking': {
                            core: 03,
                            comment: 'Curve tracking OFF'
                        }
                    }
                },
                'AF Sensitivity': {
                    prefix: '04 58',
                    packets: {
                        'High': '01',
                        'Middle': '02',
                        'Low': '03'
                    }
                },
                'AF Frame': {
                    prefix: '04 5C',
                    packets: {
                        'Auto': '01',
                        'Full Frame': '02',
                        'Center': '03',
                        'Auto/Full Frame/Center': '10'
                    }
                },
                'CAM_ZoomFocus': {
                    packets: {
                        'Direct': {
                            core: '04 47 0p 0q 0r 0s 0t 0u 0v 0w 0x',
                            markers: {
                                'pqrs': zoomPosition,
                                'tuvw': focusPosition,
                                'x': zoomAndFocusSpeed
                            }
                        }
                    }
                },
                'Resolution Setting': {
                    core: '06 35 0p 0q',
                    markers: {
                        'pq': resolution
                    }
                },
                'CAM_Memory': {
                    prefix: '04',
                    markers: {
                        'gp': {
                            parameters: {
                                'Memory Number': {
                                    type: 'range',
                                    min: 0,
                                    max: 255,
                                }
                            },
                            encoder: parameters => [ parameters['Memory Number'] < 128 ? 0 : 1, parameters['Memory Number'] % 128 ]
                        }
                    },
                    packets: {
                        'Reset': '3F g0 pp',
                        'Set': '3F g1 pp',
                        'Recall': '3F g2 pp'
                    }
                }
            }
        },
        'inquery': {
            prefix: '09',
            answer: {
                prefix: '50',
            },
            error: {
                packets: {
                    'Command not executable': '60 41'
                }
            },
            packets: {
                'CAM_PowerInq': {
                    core: '04 00',
                    answer: {
                        packets: powerPackets
                    }
                },
                'CAM_SystemStatusInq': {
                    core: '04 00 01',
                    answer: {
                        packets: {
                            'Ready': '00',
                            'Processing': '01'
                        }
                    }
                },
                'CAM_OpticalZoomPosInq': {
                    core: '04 47',
                    answer: {
                        packets: {
                            '': {
                                core: '0p 0q 0r 0s',
                                markers: {
                                    'pqrs': {
                                        parameters: {
                                            'Zoom Position': {
                                                type: 'range',
                                                min: 0x0000,
                                                max: 0x4000,
                                            }
                                        },
                                        decoder: markers => ({ 'Zoom Position': utils.hexArrayToUint(markers) })
                                    }
                                }
                            }
                        }
                    }
                },
                'CAM_ZoomMemoryModeInq': {
                    core: '04 47 00',
                    answer: {
                        packets: zoomMemoryModePackets
                    }
                },
                'CAM_FocusModeInq': {
                    core: '04 38',
                    answer: {
                        packets: {
                            'Auto Focus': '02',
                            'Manual Focus': '03'
                        }
                    }
                },
                'CAM_FocusPosInq': {
                    core: '04 48',
                    answer: {
                        packets: {
                            '': {
                                core: '0p 0q 0r 0s',
                                markers: {
                                    'pqrs': focusPosition
                                }
                            }
                        }
                    }
                },
                'CAM_CurveModeInq': {
                    core: '04 38 03',
                    answer: {
                        packets: {
                            'Curve tracking': '02',
                            'Zoom tracking': '03'
                        }
                    }
                },
                'AF SensitivityInq': {
                    core: '04 58',
                    answer: {
                        packets: {
                            'High': '01',
                            'Middle': '02',
                            'Low': '03'
                        }
                    }
                },
                'AF FrameInq': {
                    core: '04 5C',
                    answer: {
                        packets: {
                            'Auto': '01',
                            'Full Frame': '02',
                            'Center': '03'
                        }
                    }
                },
                'Resolution SettingInq': {
                    core: '06 23',
                    answer: {
                        packets: {
                            '': {
                                core: '0p 0q',
                                markers: {
                                    'pq': resolution
                                }
                            }
                        }
                    }
                },
                'CAM Version Inq': {
                    core: '00 02',
                    answer: {
                        packets: {
                            '': {
                                core: 'pp qq rr ss jj jj kk',
                                markers: {
                                    'pqrs': cameraModel,
                                    'j': romVersion,
                                    'k': maximumSocket
                                }
                            }
                        }
                    }
                }
            }
        },
        'device setting command': {
            packets: {
                'CommandCancel': {
                    pattern: '8x 2p FF',
                    markers: {
                        'x': receiverAddress,
                        'p': socket
                    }
                },
                'IF_Clear': {
                    pattern: '8X 01 00 01 FF',
                    markers: {
                        'X': receiverAddress,
                    },
                    answer: {
                        packets: {
                            'Ack': {
                                core: '50'
                            }
                        }
                    }
                },
                'IF_Clear (broadcast)': {
                    pattern: '88 01 00 01 FF',
                    answer: {
                        packets: {
                            'Ack': {
                                pattern:'88 01 00 01 FF'
                            }
                        }
                    }
                }
            }
        }
    }
}

class MarshallController extends ViscaController {
//    static _requestSet = requestSet

    constructor(connection, address=1) {
        super(connection, address, n_sockets)
        this._requestSet = utils.decompressRequestSet(requestSet)
    }
}

module.exports = MarshallController