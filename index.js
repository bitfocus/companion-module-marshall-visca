var instance_skel = require('../../instance_skel');
var MarshallCamera = require('./visca/index');
const { Range, List } = require('./visca/lib/Parameters');

class instance extends instance_skel {
    constructor(system, id, config) {
        super(system, id, config)
        
        this.initActions()
    }

    init() {
        this.camera = new MarshallCamera(this.config.host)
    }

    updateConfig(config) {
        if (this.config.host !== config.host) {
            this.camera = new MarshallCamera(config.host)
        }
        this.config = config
    }

    destroy() {

    }

    config_fields() {
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

    initActions() {
        let actions = {}

        let commandsArray = MarshallCamera.COMMANDS.list()
        

        for (const command of commandsArray) {
            const pattern = command.pattern
            const parameters = pattern.getParameters()

            let options = []
            for (const parameter of parameters) {
                let option = {
                    id: parameter.name,
                    label: parameter.name,
                }
                option.tooltip = parameter.comment
                switch (parameter.constructor) {
                    case Range:
                        option.type = 'number',
                        option.min = parameter.min,
                        option.max = parameter.max,
                        option.default = parameter.min
                        option.required = true
                        break
                    case List:
                        option.type = 'dropdown',
                        option.choices = parameter.itemNameArray.map(itemName => ({ id: itemName, label: itemName}))
                        option.default = parameter.itemNameArray[0]
                        break
                }
                options.push(option)
            }
            
            actions[command.name] = {
                label: command.name,
                options: options,
                callback: ((action, _) => {
                    this.camera.sendCommand(command, action.options)
                })
            }
        }

        this.setActions(actions)
    }
}

exports = module.exports = instance;