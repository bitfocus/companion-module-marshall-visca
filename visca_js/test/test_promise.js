function promiseAnswer (expectedData) {
    return new Promise(function(resolve, reject) {
        setTimeout(() => resolve(1), 1000);
    }).then((data) => { 
        return new Promise((resolve, reject) => {
            if (data === expectedData) { 
                resolve(data[0])
            } else {
                reject()
            }
        })
    })
}

promiseAnswer(3).then(a => console.log(a)).catch(a => console.log('Erra'))