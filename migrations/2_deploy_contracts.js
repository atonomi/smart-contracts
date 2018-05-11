const AtonomiToken = artifacts.require('AMLToken')
const SafeMathLib = artifacts.require('SafeMathLib')
const Atonomi = artifacts.require('Atonomi')
const init = require('../test/helpers/init')

module.exports = function (deployer, network, accounts) {
  const actors = init.getTestActorsContext(accounts)
  const owner = actors.owner

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier
  const reputationShare = 20
  const blockThreshold = 5760 // assuming 15s blocks, 1 write per day

  let a, t
  deployer.deploy(SafeMathLib)
  deployer.link(SafeMathLib, AtonomiToken)
  deployer.deploy(AtonomiToken, 'Atonomi Token', 'ATMI', 1000000000000000000000000000, tokenDecimals, false, {from: owner})
    .then(() => deployer.deploy(Atonomi,
      AtonomiToken.address,
      regFee, actFee, repReward,
      reputationShare, blockThreshold, {from: owner}))

    // for web deployments configure ganache coinbase as a super user
    .then(() => Atonomi.deployed())
    .then((instance) => {
      a = instance
      if (network === 'web') {
        return a.addNetworkMember(
          owner,
          true, // irn admin
          true, // manufacturer
          true, // irn node
          'DEV', // manufacturer id
          { from: owner })
      }
    })
    .then((tx) => network === 'web' ? console.log('Owner set as super user:', tx.receipt.status) : null)

    // for web deployments configure token for release
    .then(() => AtonomiToken.deployed())
    .then((instance) => {
      t = instance
      if (network === 'web') {
        return t.setReleaseAgent(owner, {from: owner})
      }
    })
    .then((tx) => network === 'web' ? console.log('Owner set as release agent:', tx.receipt.status) : null)
    .then(() => network === 'web' ? t.releaseTokenTransfer({from: owner}) : null)
    .then((tx) => network === 'web' ? console.log('Token transfers enabled:', tx.receipt.status) : null)
}
