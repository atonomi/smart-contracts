/* global artifacts */

const AtonomiToken = artifacts.require('AtonomiToken')

module.exports = function (deployer) {
  deployer.deploy(
    AtonomiToken
  )
}
