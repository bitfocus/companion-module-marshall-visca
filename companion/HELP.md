## Marshall VISCA

Controls Marshall CV PTZ cameras (CV605, CV607, CV612, CV620, CV630, CV730) with VISCA.

### Configuration

- **Number of cameras**: one connection controls up to 8 cameras.
- **Camera name, IP or hostname and model** for each camera. The model hides values it does not support, e.g. UHD resolutions on Full HD models (only if no camera supports them). Choose _Other_ if your model is not listed.
- **VISCA Port**: `52381` for VISCA over IP.
- **Protocol**:
  - _VISCA over IP_ (UDP with the VISCA over IP header) is the default of Marshall cameras.
  - _Raw VISCA over TCP/UDP_ only for cameras or firmwares that require it. Raw VISCA has no sequence numbers, so commands are sent one after another.
- **Status polling interval**: how often variables and feedbacks are updated (default 2 s). The power inquiry also checks the connection. `0` disables polling and the connection check.

Port, protocol and polling interval apply to all cameras. VISCA over IP has to be enabled in the network settings of the cameras.

### Selecting the camera

All actions and feedbacks have a **Camera** option. `0` (default) controls the **selected camera**, a number controls that camera.

- **Camera - Select** selects a camera. The number can be an expression, e.g. a custom variable: `$(internal:custom_camera)`. To follow a variable automatically, add a trigger _on variable change_ that runs this action.
- **Camera - Select Next / Previous** step through the configured cameras.
- The presets in _Camera Selection_ select a camera and are green while it is selected.

So one page with pan/tilt, zoom, presets and color buttons controls whichever camera is selected.

### Actions

- **Pan Tilt**: drive in 8 directions, stop, home, reset, absolute and relative position, limits
- **Pan Tilt - Move (Module Speed)** and **Zoom - Move (Module Speed)**: use the speed stored in the module, change it with **Speed - Set / Increase / Decrease**
- **Preset**: recall, set and clear presets 0 to 127
- **Zoom**, **Focus**, **Autofocus**, **Zoom and Focus**: movement, direct positions, auto/manual focus, one push
- **Exposure**: AE mode, iris, shutter, gain, bright, exposure compensation, backlight, WDR
- **Image**: aperture (sharpness), color gain (saturation), hue, gamma, noise reduction, flip, mirror, defog, picture freeze
- **Image - Adjust Color Gain / Hue**: steps color gain or hue up/down, based on the polled value (VISCA has no up/down command for them)
- **White Balance**: mode, one push trigger, red/blue gain
- **Menu**: OSD menu on/off/toggle, navigate with _Pan Tilt - Drive_
- **Power**, **Tally**, **Resolution**, **HDMI Output Range**, **Curve Tracking**, **Initialize Lens**
- **Custom VISCA Command**: sends any command, e.g. `81 01 04 07 02 FF`

For continuous movements use a move/drive action on press and the matching stop on release, like the presets do.

Not every model supports every command or value. The camera answers unsupported commands with an error, which is shown in the log.

The connection status is OK when all cameras are reachable. A warning lists the cameras that are not.

### Variables

`selected_camera` and `selected_camera_name` show the selection. The following values are available for the selected camera without prefix (e.g. `iris`) and for each camera with the prefix `cam<number>_` (e.g. `cam2_iris`, also `cam2_name`):

Power, zoom/focus/iris/shutter/gain/bright/pan/tilt position, iris as F-number, focus/white balance/AE mode, red/blue gain, color gain, hue, aperture, exposure compensation, backlight, WDR, the last recalled or stored preset (empty after a manual pan/tilt move), vendor and model ID, ROM version and the module speed (`pan_speed`, `tilt_speed`, `zoom_speed`).

Values the camera does not report stay empty.

### Feedbacks

- Camera is selected
- Power is on
- Preset was recalled last
- Focus mode, white balance mode, AE mode
- Setting is on: backlight, WDR, exposure compensation

### Presets

- Camera selection (with more than one camera): select camera 1 to 8, next/previous
- Pan/tilt arrows, zoom, speed up/down, power, focus
- Presets 0 to 15: a short press recalls the preset, holding the button for 2 s stores the current position
- Exposure / Iris: AE modes, iris, shutter, gain, bright, exposure compensation, backlight, WDR
- Color / White Balance: WB modes, one push trigger, red/blue gain, color gain, hue
- Image: sharpness, picture freeze

Up/down buttons show the current value. Iris, shutter and gain only change in the matching AE mode, red/blue gain only in white balance mode Manual.
