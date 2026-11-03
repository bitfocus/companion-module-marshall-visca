## Marshall VISCA

Controls Marshall CV PTZ cameras (e.g. CV605, CV607, CV612, CV620, CV630, CV730) with VISCA over IP.

### Configuration

- **Camera IP**: IP address of the camera.
- **VISCA Port**: UDP port for VISCA over IP, `52381` by default.

VISCA over IP has to be enabled in the network settings of the camera.
The connection status turns green once the camera answers the VISCA sequence number reset.

### Actions

- **Power**: on / standby
- **Pan Tilt**: drive in 8 directions with pan and tilt speed, stop, home, reset
- **Preset**: recall, set and clear presets 0 to 127
- **Zoom**: stop, tele/wide (standard, variable speed, step), direct position
- **Focus**: stop, far/near (standard, variable speed, step), direct position, auto/manual, one push trigger
- **Autofocus**: sensitivity, frame
- **Zoom and Focus**: direct position
- **White Balance**: mode, one push trigger, red/blue gain
- **Resolution**, **HDMI Output Range**, **Curve Tracking**, **Initialize Lens**

For continuous movements use the _Pan Tilt - Drive_ (or _Zoom - Tele/Wide_) action on button press and _Pan Tilt - Stop_ (or _Zoom - Stop_) on button release.

Not every model supports every command or value (e.g. 4K resolutions). The camera answers unsupported commands with an error, which is shown in the log.
