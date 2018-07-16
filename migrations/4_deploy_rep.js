const AtonomiToken = artifacts.require('AMLToken')
const SafeMathLib = artifacts.require('SafeMathLib')
const Atonomi = artifacts.require('Atonomi')
const NetworkSettings = artifacts.require('NetworkSettings')
const init = require('../test/helpers/init')
const web3Utils = require('web3-utils')
const fs = require('fs')

module.exports = function (deployer, network, accounts) {
  if (network !== 'reputation') return

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

    .then(() => Atonomi.deployed())
    .then(instance => { a = instance })
    .then(() => AtonomiToken.deployed())
    .then(instance => { t = instance })

    // release ATMI
    .then(() => t.setReleaseAgent(owner, {from: owner}))
    .then(tx => console.log('Owner set as release agent:', tx.receipt.status))
    .then(() => t.releaseTokenTransfer({from: owner}))
    .then(tx => console.log('Token transfers enabled:', tx.receipt.status))

    // sets up development environment for testing rep server
    .then(() => a.addNetworkMember(actors.irnNode, false, false, true, '', { from: owner }))
    .then(tx => console.log('Network member added (irnNode):', tx.receipt.status))
    .then(() => a.addNetworkMember(actors.mfg, false, true, false, 'APPL', { from: owner }))
    .then(tx => console.log('Network member added (mfg): ', tx.receipt.status))
    .then(() => t.transfer(actors.mfg, regFee + regFee + actFee, { from: owner }))
    .then(tx => console.log('Tokens transferred from owner to mfg:', tx.receipt.status))
    // ...approve
    .then(() => t.approve(a.address, regFee + regFee + actFee, { from: actors.mfg }))
    .then(tx => console.log('Mfg approved tokens for Atonomi to withdraw:', tx.receipt.status))
    // ...register, activate
    .then(() => a.registerDevice(deviceRegIdHash, 'smartphone', deviceRegPubKey, { from: actors.mfg }))
    .then(tx => console.log('Device registered by mfg:', deviceRegIdHash, tx.receipt.status))
    .then(() => a.registerAndActivateDevice(deviceAct, 'smartphone', deviceActPubKey, { from: actors.mfg }))
    .then(tx => console.log('Device registered and activated by mfg:', deviceAct, tx.receipt.status))
    // create irn-config.json
    .then(() => JSON.stringify({
      nodeUrl: 'http://localhost:8545',
      contractAddr: a.address,
      wallet: actors.irnNode,
      port: 9009,
      host: 'localhost',
      gas: 150000,
      gasPrice: 10,
      abiFilePath: '../AtonomiGanache.json'
    }, null, 2))
    .then(irnconfig => fs.writeFile('../reputation-server-api/irn-config.json', irnconfig, 'utf8', function (err) {
      if (err) { return console.log(err) }
      console.log('json config file written!')
    }))
}
