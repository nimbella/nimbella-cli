const { ToWords } = require('to-words');

function main() {
    const toWords = new ToWords();
    return {"body": toWords.convert(9999)}
}

exports.main = main;
