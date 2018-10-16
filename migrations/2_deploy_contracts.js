const AtonomiToken = artifacts.require('AMLToken')
const SafeMathLib = artifacts.require('SafeMathLib')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(SafeMathLib)
  deployer.link(SafeMathLib, AtonomiToken)
}
