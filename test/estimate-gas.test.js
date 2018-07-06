const init = require('./helpers/init')
const web3Utils = require('web3-utils')
const createCsvWriter = require('csv-writer').createObjectCsvWriter

contract('Gas Estimates', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      atonomi: null
    }
  }

  const recordsForCSV = []
  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier
  const irnReward = repReward * 0.20
  const mfgReward = repReward - irnReward
  const deviceId = 'apple-iphone1'
  const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
  const mfgId = 'APPLE'
  const deviceType = 'phone'
  const devicePublicKey = 'somepublickey'
  const score = 'somescore'
  const memberId = 'APPLE'
  const csvWriter = createCsvWriter({
    path: 'output/gasOutput.csv',
    header: [
      {id: 'scope', title: 'SCOPE'},
      {id: 'task', title: 'TASK'},
      {id: 'gas', title: 'COST IN WEI'}
    ]
  })

  var gasAddMfg = ''
  var gasWithdrawToken = ''

  beforeEach(async () => {
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)
    await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
    await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})
    var tx = await ctx.contracts.atonomi.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
    gasAddMfg = tx.receipt.gasUsed
  })

  describe('global costs', () => {
    it('   ^= to Deposit Tokens (incl. Approval)', async() => {
      // prereq
      await ctx.contracts.token.transfer(ctx.actors.alice, regFee, {from: ctx.actors.owner})
      // begin calc
      var tx = await ctx.contracts.token.approve(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.alice})
      var gas = tx.receipt.gasUsed
      gas += await ctx.contracts.atonomi.depositTokens.estimateGas(memberId, regFee, {from: ctx.actors.alice})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'global', task: 'deposit tokens', gas: gas})
    })
  })

  describe('atonomi costs', () => {
    it('   ^= to Add Admin', async () => {
      var gas = await ctx.contracts.atonomi.addNetworkMember.estimateGas(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'atonomi', task: 'add admin', gas: gas})
    })

    it('   ^= to Add Manufacturer', async () => {
      console.log('      ✓ ' + gasAddMfg + ' wei')
      recordsForCSV.push({scope: 'atonomi', task: 'add mfgr', gas: gasAddMfg})
    })

    it('   ^= to Set Manufacturer Default Reputation', async () => {
      const gas = await ctx.contracts.atonomi.setDefaultReputationForManufacturer.estimateGas(mfgId, '6767-1-1', {from: ctx.actors.owner})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'atonomi', task: 'set manufacturer default reputation', gas: gas})
    })

    it('   ^= to Add IRN Nodes', async () => {
      var gas = await ctx.contracts.atonomi.addNetworkMember.estimateGas(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'atonomi', task: 'add irn node', gas: gas})
    })
  })

  describe('manufacturer costs', () => {
    it('   ^= to Register Device (incl. Approval)', async () => {
      var approveTxHash = await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      var gas = web3.eth.getTransactionReceipt(approveTxHash).gasUsed
      gas += await ctx.contracts.atonomi.registerDevice.estimateGas(deviceIdHash, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'mfgr', task: 'register device', gas: gas})
    })

    it('   ^= to Register and Activate Device (incl. Approval)', async () => {
      var approveTxHash = await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee), { from: ctx.actors.mfg })
      var gas = web3.eth.getTransactionReceipt(approveTxHash).gasUsed
      gas += await ctx.contracts.atonomi.registerAndActivateDevice.estimateGas(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'mfgr', task: 'reg & act device', gas: gas})
    })

    it('   ^= to Withdraw Tokens', async () => {
      // prereq
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.updateReputationScore(deviceId, score, {from: ctx.actors.irnNode})
      const testWithdraw = { account: ctx.actors.mfg, expectedTokens: mfgReward }
      const from = testWithdraw.account
      // begin calc
      gasWithdrawToken = await ctx.contracts.atonomi.withdrawTokens.estimateGas({ from: from })
      console.log('      ✓ ' + gasWithdrawToken + ' wei')
      recordsForCSV.push({scope: 'mfgr', task: 'withdraw tokens', gas: gasWithdrawToken})
    })
  })

  describe('owner costs', () => {
    it('   ^= to Activate Device (incl. Approval)', async() => {
      // prereq
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      // begin calc
      const approveTxHash = await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      var gas = web3.eth.getTransactionReceipt(approveTxHash).gasUsed
      gas += await ctx.contracts.atonomi.activateDevice.estimateGas(deviceId, {from: ctx.actors.deviceOwner})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'owner', task: 'activate device', gas: gas})
    })
  })

  describe('reputation author costs', () => {
    beforeEach(async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
    })
    it('   ^= to Submit Reputation', async () => {
      // prereq
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      // begin calc
      const gas = await ctx.contracts.atonomi.updateReputationScore.estimateGas(deviceId, score, {from: ctx.actors.irnNode})
      console.log('      ✓ ' + gas + ' wei')
      recordsForCSV.push({scope: 'reputation author', task: 'submit reputation', gas: gas})
    })
    it('   ^= to Withdraw Tokens', async() => {
      console.log('      ✓ ' + gasWithdrawToken + ' wei')
      recordsForCSV.push({scope: 'reputation author', task: 'withdraw tokens', gas: gasWithdrawToken})
    })
  })

  describe('writing output', () => {
    it('to CSV...', () => {
      csvWriter.writeRecords(recordsForCSV)
    })
  })
})
