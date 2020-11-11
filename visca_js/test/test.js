
const promiseWithTimeout = (timeoutMs, promise, failureMessage) => { 
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(failureMessage)), timeoutMs);
  });

  return Promise.race([ 
    promise(), 
    timeoutPromise, 
  ]).then((result) => {
    clearTimeout(timeoutHandle);
    return result;
  }); 
}

const MarshallController = require('../lib/MarshallController')

let ip = '192.168.102.33'
// ip = '192.168.178.43';
let s = MarshallController.useUdp(ip)

/*let msg = s.sendViscaCommand(['CAM_Power', 'On'])
msg.completion.then((value) => console.log('Angegangen'), (err) => console.log('Angehen hat nicht funktioniert ' + err)).finally(function () {
    let set139 = s.sendViscaCommand(['CAM_Memory', 'Set'], {'Memory Number': 139})
    
    let recall1 = s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 1})
    recall1.ack.then(() => console.log('Fahre los auf 1'), (err) => console.log('Wollte nicht auf 1 fahren'))
    recall1.completion.then(() => console.log('Bin bei 1'), (err) => console.log('Konnte nicht auf 1 fahren')).finally(() => {
        console.log('Los gehts zur 139')
        s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 139})
    })
    
    setTimeout(function() {
        let inq = s.sendViscaInquery('CAM_PowerInq')
        inq.answer.then((value) => console.log(`Es ist ${JSON.stringify(value)}`), (err) => console.log('Keiner mag errors: ' + err))
    }, 1000)
})*/

let success = data => console.log(`Succeded ${JSON.stringify(data)}`)
let error = data => console.log(`Failed ${JSON.stringify(data)}`)
s.sendViscaCommand(['CAM_Power', 'On']).completion.then(success).catch(error).then(() => {
	// s.sendViscaCommand(['CAM_Memory', 'Set'], {'Memory Number': 130}).completion.then(success).catch(error).finally(() => {
		// let recall1 = s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 1})
		// recall1.completion.then(success).catch(error)
		// recall1.ack.then(() => s.sendViscaDeviceSettingCommand('CommandCancel', {'Socket': recall1.socket+1}))
		// s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 2}).completion.then(success).catch(error)
		// s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 3}).completion.then(success).catch(error)
		// s.sendViscaInquery('CAM_PowerInq').answer.then(success).catch(error)
		// s.sendViscaInquery('CAM Version Inq').answer.then(success).catch(error)
		// s.sendViscaInquery('CAM_ZoomMemoryModeInq').answer.then(success).catch(error)
		// s.sendViscaInquery('CAM_OpticalZoomPosInq').answer.then(success).catch(error)
		// s.sendViscaCommand(['CAM_Memory', 'Recall'], {'Memory Number': 130}).completion.then(success).catch(error)
		// s.sendViscaCommand(['CAM_Power', 'Off (Standby)']).completion.then(success).catch(error)
	// })

	s.sendViscaInquery('CAM Version Inq').answer.then(success).catch(error)
	s.sendViscaInquery('Resolution SettingInq').answer.then(success).catch(error)
	s.sendViscaInquery('CAM_FocusModeInq').answer.then(success).catch(error)
	s.sendViscaInquery('CAM_FocusPosInq').answer.then(success).catch(error)
	
	// s.sendViscaCommand('Resolution Setting', { 'Resolution': 'FHD 1080P(1920 x 1080) - 29.97p' }).completion.then(success).catch(error)

	let manu = s.sendViscaCommand(['CAM_Focus', 'Manual Focus'])
	manu.completion.then(success).catch(error)
	manu.completion.then(() => {
		s.sendViscaInquery('CAM_FocusModeInq').answer.then(success).catch(error)
		let trigger = s.sendViscaCommand(['CAM_Focus', 'One Push Trigger'])
		trigger.completion.then(success).catch(error)
		trigger.completion.then(() => {
			s.sendViscaInquery('CAM_FocusPosInq').answer.then(success).catch(error)
			s.sendViscaCommand(['CAM_Focus', 'Far (Variable)'], { 'Speed': 7 })
		}).catch(error)
	}).catch(error)
	setTimeout(() => {
		s.sendViscaInquery('CAM_FocusPosInq').answer.then(success).catch(error)
		s.sendViscaCommand(['CAM_Focus', 'Auto Focus']).completion.then(success).catch(error)
	}, 20000)
})