const MarshallController = require('../lib/MarshallController')

let ip = '192.168.102.34'
// ip = '192.168.178.43';
let camera = MarshallController.useUdp(ip)

let success = data => console.log(`Succeded ${JSON.stringify(data)}`)
let error = data => console.log(`Failed ${JSON.stringify(data)}`)

camera.sendViscaCommand(['CAM_Power'], { 'Address': 1, 'Power Mode': 'Off (Standby)' }).completion.then(success).catch(error).then(() => {
	camera.sendViscaCommand(['CAM_Focus', 'Far (Variable)'], { 'Address': 1, 'Speed': 7 })
	setTimeout(() => {
		camera.sendViscaCommand(['CAM_Focus', 'Far (Variable)'], { 'Address': 1, 'Speed': 7 }).completion.then(success).catch(error)
	}, 20000)
})