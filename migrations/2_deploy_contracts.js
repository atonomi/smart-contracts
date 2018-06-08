const AtonomiToken = artifacts.require('AMLToken')
const SafeMathLib = artifacts.require('SafeMathLib')
const Atonomi = artifacts.require('Atonomi')
const NetworkSettings = artifacts.require('NetworkSettings')
const init = require('../test/helpers/init')
const web3Utils = require('web3-utils')

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
  const deviceReg = 'apple-iphone1'
  const deviceAct = 'apple-iphone2'
  const deviceRegIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceReg)})
  const deviceRegPubKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
  const deviceActPubKey = '0x4a984091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed353'

  let a, t
  deployer.deploy(SafeMathLib)
  deployer.link(SafeMathLib, AtonomiToken)
  deployer.deploy(AtonomiToken, 'Atonomi Token', 'ATMI', 1000000000000000000000000000, tokenDecimals, false, {from: owner})
    .then(() => deployer.deploy(NetworkSettings,
      regFee, actFee,
      repReward,
      reputationShare,
      blockThreshold,
      {from: owner}))

    .then(() => deployer.deploy(Atonomi,
      AtonomiToken.address,
      NetworkSettings.address,
      {from: owner}))

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
      if (network === 'web' || network === 'reputation') {
        return t.setReleaseAgent(owner, {from: owner})
      }
    })
    .then((tx) => network === 'web' || network === 'reputation' ? console.log('Owner set as release agent:', tx.receipt.status) : null)
    .then(() => network === 'web' || network === 'reputation' ? t.releaseTokenTransfer({from: owner}) : null)
    .then((tx) => network === 'web' || network === 'reputation' ? console.log('Token transfers enabled:', tx.receipt.status) : null)

    // sets up development environment for testing rep server
    .then(() => network === 'reputation' ? a.addNetworkMember(actors.irnNode, false, false, true, '', { from: owner }) : null)
    .then((tx) => network === 'reputation' ? console.log('Network member added (irnNode):', tx.receipt.status) : null)
    .then(() => network === 'reputation' ? a.addNetworkMember(actors.mfg, false, true, false, 'APPL', { from: owner }) : null)
    .then((tx) => network === 'reputation' ? console.log('Network member added (mfg): ', tx.receipt.status) : null)
    .then(() => network === 'reputation' ? t.transfer(actors.mfg, regFee + regFee + actFee, { from: owner }) : null)
    .then((tx) => network === 'reputation' ? console.log('Tokens transferred from owner to mfg:', tx.receipt.status) : null)
    // ...approve
    .then(() => network === 'reputation' ? t.approve(a.address, regFee + regFee + actFee, { from: actors.mfg }) : null)
    .then((tx) => network === 'reputation' ? console.log('Mfg approved tokens for Atonomi to withdraw:', tx.receipt.status) : null)
    .then(() => network === 'reputation' ? t.allowance(actors.mfg, a.address) : null)
    .then((allowance) => network === 'reputation' ? console.log('Atonomi allowed to withdraw: ' + allowance / multiplier + ' tokens') : null)
    // ...register, activate
    .then(() => network === 'reputation' ? a.registerDevice(deviceRegIdHash, 'smartphone', deviceRegPubKey, { from: actors.mfg }) : null)
    .then((tx) => network === 'reputation' ? console.log('Device registered by mfg:', deviceRegIdHash, tx.receipt.status) : null)
    .then(() => network === 'reputation' ? a.registerAndActivateDevice(deviceAct, 'smartphone', deviceActPubKey, { from: actors.mfg }) : null)
    .then((tx) => network === 'reputation' ? console.log('Device registered and activated by mfg:', tx.receipt.status) : null)
}
