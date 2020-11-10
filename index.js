var instance_skel = require('../../instance_skel');
var MarshallController = require('visca_js');
const { options } = require('marked');
var debug;
var log;

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)
		debug = this.debug
		log = this.log

		this.controller = MarshallController.useUdp('192.168.102.33')
		this.initActions()
	}

	init () {
		this.status(this.STATUS_OK, 'Hi')
	}

	destroy () {

	}

	config_fields () {
		return [
			{
				type:  'text',
				id:    'info',
				width: 12,
				label: 'Information',
				value: 'This will establish a TCP connection to the device'
			},
			{
				type:  'textinput',
				id:    'host',
				label: 'Target IP',
				width: 6,
				regex: this.REGEX_IP
			}
		]
	}

	initActions () {
		let actions = {}

		const addPacket = function (packet) {
			let options = []
			if (packet.hasOwnProperty('markers')) {
				for (const marker of Object.values(packet.markers)) {
					for (const [parameterName, parameterObject] of Object.entries(marker.parameters)) {
						if (parameterObject.internal === true) {
							continue
						}
						let option = {
							id: parameterName,
							label: parameterName,
						}
						if (parameterObject.hasOwnProperty('comment')) {
							option.tooltip = parameterObject.comment
						}
						switch (parameterObject.type) {
							case 'range':
								option.type = 'number',
								option.min = parameterObject.min,
								option.max = parameterObject.max,
								option.required = true
								break
							case 'list':
								option.type = 'dropdown',
								option.choices = Array.from(Object.keys(parameterObject.list), key => ({ id: key, label: key }))
								break
						}
						options.push(option)
					}
				}
			}
			actions[packet.name] = {
				label: `${packet.name.slice(-2, -1)} - ${packet.name.slice(-1)}`,
				options: options,
				callback: ((action, bank) => {
					this.controller.sendViscaCommand(packet.name.slice(2), action.options)
				})
			}
		}.bind(this)

		const loopPackets = function (packets) {
			for (const packet of Object.values(packets)) {
				if (packet.hasOwnProperty('pattern')) {
					addPacket(packet)
				}
				if (packet.hasOwnProperty('packets')) {
					loopPackets(packet.packets)
				}
			}
		}

		loopPackets(this.controller._requestSet.packets.command.packets)

		this.setActions(actions)
	}
}

exports = module.exports = instance;