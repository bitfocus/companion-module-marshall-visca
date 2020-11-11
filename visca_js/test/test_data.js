const { Parameter, Range, List, ParameterGroup } = require('../lib/requestClasses')

let speed = new Range('Speed', 0, 7, '0 (Low) to 7 (High)')
let zoomAndFocusSpeed = new ParameterGroup([speed], parameters => [ parameters['Speed'] ])

console.log(zoomAndFocusSpeed.decoder({'Speed': 3}))