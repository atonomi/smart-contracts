require('babel-register')
require('babel-polyfill')

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8546,
      network_id: '*' // Match any network id
    },
    web: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*' // Match any network id
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '*',
      port: 8546,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    reputation: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*'
    },
    local: {
      host: '127.0.0.1',
      port: 8545,
      from: '0x48015f23eb79791050885f9464e6dea7456df60b',
      network_id: '*' // Match any network id
    }
  }
}
