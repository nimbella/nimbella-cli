function main(args) {
    const config = require('./config.json')
    let name = config.name
    let greeting = 'Hello ' + name + '!'
    console.log(greeting)
    return {"body": greeting}
}

exports.main=main
  