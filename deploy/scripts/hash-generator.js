const params = process.argv.slice(2);

const web3Utils = require('web3-utils')
const Web3 = require('web3')

const nodeUrl = params[0]
console.log('node:', nodeUrl)
const web3 = new Web3(nodeUrl)

const text = params[1]
console.log('ascii:', text)

const hexText = web3.fromAscii(text)
console.log('hex', hexText)

const hash = web3Utils.soliditySha3({t: 'bytes32', v: hexText})

console.log('hash:', hash)
