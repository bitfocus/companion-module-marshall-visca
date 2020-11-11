class Parameter {
    constructor(name, comment) {
        this.name = name
        this.comment = comment
    }

    validate() {
        throw Error('Function not implemented')
    }
}

class Range extends Parameter {
    constructor(name, min, max, comment) {
        super(name, comment)
        
        if (!(min <= max)) {
            // This error is also thrown when one of the values is undefined
            throw new TypeError('The minimum value must be smaller or equal the maximum value')
        }
        this.min = min
        this.max = max
    }

    validate(value) {
        return (value >= this.min && value <= this.max)
    }
}

class List extends Parameter {
    constructor(name, valueArray, comment) {
        super(name, comment)

        this.list = list
    }

    validate(value) {
        return this.list.includes(value)
    }
}

class ParameterGroup {
    constructor(parameterArray, encoder, decoder) {
        this.parameterArray = parameterArray
        this.encoder = encoder || this.encoder
        this.decoder = decoder || this.decoder
    }

    encoder() {
        throw Error('No encoder implemented for this parameter group')
    }

    decoder() {
        throw Error('No decoder implemented for this parameter group')
    }
}

class MarkerObject {
    constructor(markers, parameterGroup) {

    }
}

class RequestObject {
    constructor(name, parentObject, options) {
        this.name = name
        this.parentObject = parentObject
        
        this.prefix = options.prefix
        this.postfix = options.postfix
        this.markers = options.markers
        this.reply = options.reply
        this.error = options.error
        this.comment = options.comment
    }
}

class Packet extends RequestObject {
    constructor(name, parentObject, options) {
        if (typeof options === 'object') {
            super(name, parentObject, options)
            this.core = options.pattern
            this.coreOnly = options.coreOnly
        } else {
            super(name, parentObject, {})
            this.core = options
        }


    }


    createPayload(parameterDict) {

    }
}

module.exports = {
    Parameter: Parameter,
    Range: Range,
    List: List,
    ParameterGroup: ParameterGroup
}