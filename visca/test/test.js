const MarshallCamera = require('../lib/Marshall/MarshallCamera')
const commands = require('../lib/Marshall/commands')

let ip = '192.168.102.34'
// ip = '192.168.178.43';
let camera = new MarshallCamera(ip)

let success = data => {
    console.log('Succeded', JSON.stringify(data))
    return data
}
let error = data => {
    console.log('Failed', JSON.stringify(data))
    return data
}

const powerCommand = commands['power']
camera.sendCommand(powerCommand, { 'Address': 1, 'Power Mode': 'Off (Standby)' }).completion.then(success).catch(error).then(() => {
    console.log('HI')
})

// camera.sendViscaCommand(['CAM_Power'], { 'Address': 1, 'Power Mode': 'On' }).completion.then(success).catch(error).then(() => {
// camera.sendViscaCommand(['CAM_Power'], { 'Address': 1, 'Power Mode': 'Off (Standby)' }).completion.then(success).catch(error).then(() => {
//     camera.sendViscaCommand(['CAM_Power'], { 'Address': 1, 'Power Mode': 'On' }).completion.then(success).catch(error).then(() => {
//         camera.sendViscaCommand(['CAM_Focus', 'Mode'], { 'Focus Mode': 'Manual Focus'}).completion.then(success).catch(error)
//         camera.sendViscaCommand(['CAM_Focus', 'Far (Variable)'], { 'Address': 1, 'Speed': 7 }).completion.then(success).catch(error)
//     })
// })