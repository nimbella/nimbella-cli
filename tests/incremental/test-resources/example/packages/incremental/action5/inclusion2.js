function main(args) {
    let expr = args['text']
    let result = eval(expr)
    return { 'result': result }
}

exports.main = main
