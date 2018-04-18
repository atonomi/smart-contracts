/* global artifacts */

const AtonomiToken = artifacts.require('AMLToken')
const SafeMathLib = artifacts.require('SafeMathLib')
const init = require('../test/helpers/init')

module.exports = function (deployer, network, accounts) {
  const actors = init.getTestActorsContext(accounts)
  const owner = actors.owner
  deployer.deploy(SafeMathLib)
  deployer.link(SafeMathLib, AtonomiToken)
  deployer.deploy(AtonomiToken, 'Atonomi Token', 'ATMI', 1000000000000000000000000000, 18, false, {from: owner})
}
