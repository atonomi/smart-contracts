const params = process.argv.slice(2);

const web3Utils = require('web3-utils')
const Web3 = require('web3')

const nodeUrl = params[0]
console.log('node:', nodeUrl)

const text = params[1]
console.log('text:', text)

const web3 = new Web3(nodeUrl)
const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(text)})

console.log('hash:', hash)
