var async = require('async')

class Person {
    constructor (name) {
        this._name = name;
    }

    get name () {
        return this._name;
    }

    set name(name) {
        this._name = name;
    }
}

// create a queue object with concurrency 2
var q = async.queue(function(task, callback) {
    console.log('Hello ' + task.name);
    setTimeout(() => {
        console.log('Bye ' + task.name);
        callback();
    }, 1000);
}, 1);

// assign a callback
q.drain = function() {
  console.log('All items have been processed');
};

// add some items to the queue
q.push(new Person('foo'), function(err) {
    console.log('Finished processing foo');
});

q.push(new Person('bar'), function (err) {
    console.log('Finished processing bar');
});

// add some items to the queue (batch-wise)
q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function(err) {
    console.log('Finished processing item');
});

// add some items to the front of the queue
q.unshift({name: 'barista'}, function (err) {
    console.log('Finished processing barista');
});

setTimeout(() => {
    q.unshift({name: 'late_barista'}, function (err) {
        console.log('Finished processing late_barista');
    });
}, 5200)

console.log('Done')