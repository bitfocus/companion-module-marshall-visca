class CommandSet {
    constructor(commandArray) {
        this._commandMapMap = new Map()
        commandArray.forEach(command => {
            const name = command.name
            const familyName = command.familyName

            let familyMap = this._commandMapMap.get(familyName)
            if (familyMap === undefined) {
                familyMap = new Map()
                this._commandMapMap.set(familyName, familyMap)
            }
            if (familyMap.has(name)) {
                throw new Error(`Two commands from the same family with the same name found: ${familyName}:${name}`)
            }
            familyMap.set(name, command)
        })
    }

    get(familyName, name) {
        const familyMap = this._commandMapMap.get(familyName)
        if (familyMap === undefined) {
            return undefined
        }
        return familyMap.get(name)
    }
}

module.exports = CommandSet