function main(params) {
  const rot13Cipher = require("rot13-cipher");
  return { "msg": rot13Cipher("this is the second message") }
}

exports.main = main
