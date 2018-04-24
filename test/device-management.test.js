import { expect } from 'chai'
const init = require('./helpers/init')
const errors = require('./helpers/errors')
const web3Utils = require('web3-utils')
const ethjsABI = require('ethjs-abi')
const MockSolHash = artifacts.require('MockSolHash')

contract('Device Management', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      mockSolHash: null,
      token: null,
      atonomi: null
    }
  }

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier

  const deviceId = 'apple-iphone1'
  const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
  const hwPubKey = 'somepubkey'
  const mfgId = 'APPLE'

  beforeEach(async () => {
    ctx.contracts.mockSolHash = await MockSolHash.new({from: ctx.actors.owner})
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)

    await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
    await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
  })

  describe('hashing', () => {
    it('can build hash in JavaScript and verify in Solidity', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test')
      expect(hash).to.be.equal(solHash)
    })

    it('can create a bad match in Solidity', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test2')
      expect(hash).not.to.be.equal(solHash)
    })

    it('can create a bad match in JavaScript', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test2')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test')
      expect(hash).not.to.be.equal(solHash)
    })
  })

  describe('register device', () => {
    let poolStartingBalance
    let mfgStartingBalance
    let claimStarting

    beforeEach(async () => {
      poolStartingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
    })

    it('mfg can register', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      const success = await ctx.contracts.atonomi.registerDevice.call(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args.fee.toString(10)).to.be.equal(regFee.toString(10))
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(false)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal(regFee.toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const poolEndingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal(regFee.toString(10))
    })

    it('external accounts can not register', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, {from: from})
        const fn = ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register device that is already registered', async () => {
      const from = ctx.actors.mfg
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, 2 * regFee, {from: from})
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
      const fn = ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
      await errors.expectRevert(fn)
    })

    it('can not register with insufficent funds', async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.alice })
      const fn = ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('activate device', () => {
    let poolStartingBalance
    let mfgStartingBalance
    let devOwnerStartingBalance
    let claimStarting

    beforeEach(async () => {
      devOwnerStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      poolStartingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
    })

    it('device owner can activate', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const success = await ctx.contracts.atonomi.activateDevice.call(deviceId, {from: ctx.actors.deviceOwner})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceActivated')
      expect(log.args._sender).to.be.equal(ctx.actors.deviceOwner)
      expect(log.args.fee.toString(10)).to.be.equal(actFee.toString(10))
      expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.deviceOwner)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal(actFee.toString(10))

      const devOwnerEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      expect((devOwnerStartingBalance - devOwnerEndingBalance).toString(10)).to.be.equal(actFee.toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const poolEndingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('persons without the device can not activate', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      const wrongDeviceId = 'samsung-microwave1'
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const fn = ctx.contracts.atonomi.activateDevice(wrongDeviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate device that is not registered', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const fn = ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate device that is already activated', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      await ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
      const fn = ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate with insufficent funds', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.alice })
      const fn = ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('register and activate device', () => {
    let poolStartingBalance
    let mfgStartingBalance
    let claimStarting

    beforeEach(async () => {
      poolStartingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
    })

    it('mfg can register and activate device', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee), { from: ctx.actors.mfg })
      const success = await ctx.contracts.atonomi.registerAndActivateDevice.call(deviceId, hwPubKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(2)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args.fee.toString(10)).to.be.equal(regFee.toString(10))
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)

      const log1 = tx.logs[1]
      expect(log1.event).to.be.equal('DeviceActivated')
      expect(log1.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args.fee.toString(10)).to.be.equal(actFee.toString(10))
      expect(web3.toAscii(log1.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(3)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee + actFee).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))

      const poolEndingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('external accounts can not register and activate device', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee), {from: from})
        const fn = ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register and activate device that is already registered', async () => {
      const from = ctx.actors.mfg
      await ctx.contracts.token.transfer(ctx.actors.mfg, 2 * (regFee + actFee), {from: ctx.actors.owner})
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, 2 * (regFee + actFee), {from: from})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
      const fn = ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
      await errors.expectRevert(fn)
    })

    it('can not register and activate with insufficent funds', async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, { from: ctx.actors.alice })
      const fn = ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('reputation scores', () => {
    let irnStartingBalance
    let repAuditorStartingBalance
    let claimStarting
    const score = 'somescore'

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.atonomi.balances(ctx.actors.irnNode)
      repAuditorStartingBalance = await ctx.contracts.atonomi.balances(ctx.actors.repAuditor)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
    })

    it('IRN node can set and distribute rewards', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      const success = await ctx.contracts.atonomi.updateReputationScore.call(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})

      const contributorReward = repReward * 0.80
      const irnReward = repReward - contributorReward
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ReputationScoreUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(tx.logs[0].args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)
      expect(web3.toAscii(tx.logs[0].args._newScore).replace(/\u0000/g, '')).to.be.equal(score)
      expect(tx.logs[0].args._contributor).to.be.equal(ctx.actors.repAuditor)
      expect(tx.logs[0].args._contributorReward.toString(10)).to.be.equal(contributorReward.toString(10))
      expect(tx.logs[0].args._irnReward.toString(10)).to.be.equal(irnReward.toString(10))

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect(score).to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      const irnEndingBalance = await ctx.contracts.atonomi.balances(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal(irnReward.toString(10))

      const repAuditorEndingBalance = await ctx.contracts.atonomi.balances(ctx.actors.repAuditor)
      expect((repAuditorEndingBalance - repAuditorStartingBalance).toString(10)).to.be.equal(contributorReward.toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal((regFee + actFee - contributorReward - irnReward).toString(10))

      const testWithdraws = [
        { account: ctx.actors.repAuditor, expectedTokens: contributorReward },
        { account: ctx.actors.irnNode, expectedTokens: irnReward }
      ]
      for (let i = 0; i < testWithdraws.length; i++) {
        const from = testWithdraws[i].account
        const expectTokens = testWithdraws[i].expectedTokens
        const tokenRepBefore = await ctx.contracts.token.balanceOf(from)
        const tokenAtonomiBefore = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)

        const successWithdraw = await ctx.contracts.atonomi.withdrawTokens.call({ from: from })
        expect(successWithdraw).to.be.equal(true)

        const txWithdraw = await ctx.contracts.atonomi.withdrawTokens({ from: from })
        expect(txWithdraw.logs.length).to.be.equal(1)
        expect(txWithdraw.logs[0].event).to.be.equal('TokensWithdrawn')
        expect(txWithdraw.logs[0].args._sender).to.be.equal(from)
        expect(txWithdraw.logs[0].args._amount.toString(10)).to.be.equal(expectTokens.toString(10))

        const tokenRepAfter = await ctx.contracts.token.balanceOf(from)
        expect((tokenRepAfter - tokenRepBefore).toString(10)).to.be.equal(expectTokens.toString(10))

        const tokenAtonomiAfter = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
        expect((tokenAtonomiBefore - tokenAtonomiAfter).toString(10)).to.be.equal(expectTokens.toString(10))
      }
    })

    it('can not set score for device that is not activated', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, repReward, {from: ctx.actors.irnNode})
      const fn = ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      await errors.expectRevert(fn)
    })

    it('external accounts can not set', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      const bads = [ctx.actors.owner, ctx.actors.admin, ctx.actors.deviceOwner, ctx.actors.mfg, ctx.actors.alice]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, repReward, {from: from})
        const fn = ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: from})
        await errors.expectRevert(fn)
      }
    })
  })

  describe('bulk registrations and activations', () => {
    let poolStartingBalance
    let mfgStartingBalance
    let claimStarting

    const total = 10
    const deviceIdPrefix = 'apple-ipad'
    const hwPubKeyPrefix = 'hwpubkey'

    beforeEach(async () => {
      poolStartingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)

      await ctx.contracts.token.transfer(ctx.actors.mfg, (regFee + actFee) * total, {from: ctx.actors.owner})
    })

    it('mfg can bulk register devices', async () => {
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        hwPublicKeys.push(hwPubKeyPrefix + i)
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee * total, {from: ctx.actors.mfg})
      const success = await ctx.contracts.atonomi.registerDevices.call(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.registerDevices(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(tx.logs.length).to.be.equal(total)

      for (let i = 0; i < total; i++) {
        const log = tx.logs[i]
        expect(log.event).to.be.equal('DeviceRegistered')
        expect(log.args._sender).to.be.equal(ctx.actors.mfg)
        expect(log.args.fee.toString(10)).to.be.equal(regFee.toString(10))
        expect(log.args._deviceHashKey).to.be.equal(deviceIdHashes[i])

        const device = await ctx.contracts.atonomi.devices(deviceIdHashes[i])
        expect(web3.toAscii(device[0]).replace(/\u0000/g, '')).to.be.equal(hwPublicKeys[i])
        expect(web3.toAscii(device[1]).replace(/\u0000/g, '')).to.be.equal(mfgId)
        expect(device[2]).to.be.equal(true)
        expect(device[3]).to.be.equal(false)
        expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))
      }

      expect(tx.receipt.logs.length).to.be.equal(total + 1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee * total).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgEndingBalance - mfgStartingBalance).toString(10)).to.be.equal((regFee * total).toString(10))

      const poolEndingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal((regFee * total).toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal((regFee * total).toString(10))
    })

    it('mfg can bulk activate devices', async () => {
      const deviceIds = []
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        deviceIds.push(deviceIdPrefix + i)
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        hwPublicKeys.push(hwPubKeyPrefix + i)
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee) * total, {from: ctx.actors.mfg})
      const success = await ctx.contracts.atonomi.registerAndActivateDevices.call(deviceIds, hwPublicKeys, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.registerAndActivateDevices(deviceIds, hwPublicKeys, {from: ctx.actors.mfg})
      expect(tx.logs.length).to.be.equal(total * 2)
      for (let i = 0; i < tx.logs.length; i++) {
        const log = tx.logs[i]
        if (i % 2 === 0) {
          expect(log.event).to.be.equal('DeviceRegistered')
          expect(log.args._sender).to.be.equal(ctx.actors.mfg)
          expect(log.args.fee.toString(10)).to.be.equal(regFee.toString(10))
          expect(log.args._deviceHashKey).to.be.equal(deviceIdHashes[i / 2])
        } else {
          expect(log.event).to.be.equal('DeviceActivated')
          expect(log.args._sender).to.be.equal(ctx.actors.mfg)
          expect(log.args.fee.toString(10)).to.be.equal(actFee.toString(10))
          expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceIds[(i - 1) / 2])
        }
      }

      for (let i = 0; i < total; i++) {
        const device = await ctx.contracts.atonomi.devices(deviceIdHashes[i])
        expect(web3.toAscii(device[0]).replace(/\u0000/g, '')).to.be.equal(hwPublicKeys[i])
        expect(web3.toAscii(device[1]).replace(/\u0000/g, '')).to.be.equal(mfgId)
        expect(device[2]).to.be.equal(true)
        expect(device[3]).to.be.equal(true)
        expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))
      }

      expect(tx.receipt.logs.length).to.be.equal((total * 2) + 1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal(((regFee + actFee) * total).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgEndingBalance - mfgStartingBalance).toString(10)).to.be.equal('0')

      const poolEndingBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal(((regFee + actFee) * total).toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal(((regFee + actFee) * total).toString(10))
    })

    it('can bulk operations with some failures', async () => {
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        if (i === 0) {
          // set a zero hash
          deviceIdHashes.push('')
          hwPublicKeys.push(hwPubKeyPrefix + i)
        } else if (i === 1) {
          // set a zero pub key
          deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
          hwPublicKeys.push('')
        } else {
          deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
          hwPublicKeys.push(hwPubKeyPrefix + i)
        }
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee * total, {from: ctx.actors.mfg})
      const fn = ctx.contracts.atonomi.registerDevices(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
  })

  describe('bulk reputation updates', () => {
    let irnStartingBalance
    let repAuditorStartingBalance
    let claimStarting

    const total = 10
    const deviceIdPrefix = 'apple-ipad'
    const hwPubKeyPrefix = 'hwpubkey'

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.atonomi.balances(ctx.actors.irnNode)
      repAuditorStartingBalance = await ctx.contracts.atonomi.balances(ctx.actors.repAuditor)
      claimStarting = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)

      await ctx.contracts.token.transfer(ctx.actors.mfg, (regFee + actFee) * total, {from: ctx.actors.owner})
    })

    it('irn node can bulk update reputation scores', async () => {
      const deviceIds = []
      const deviceIdHashes = []
      const hwPublicKeys = []
      const reputationScores = []
      for (let i = 0; i < total; i++) {
        deviceIds.push(deviceIdPrefix + i)
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        hwPublicKeys.push(hwPubKeyPrefix + i)
        reputationScores.push('somecoolscore')
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee) * total, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevices(deviceIds, hwPublicKeys, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee) * total, {from: ctx.actors.irnNode})
      const success = await ctx.contracts.atonomi.updateReputationScores.call(deviceIds, reputationScores, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.updateReputationScores(deviceIds, reputationScores, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      expect(tx.logs.length).to.be.equal(total)

      const contributorReward = repReward * 0.80
      const irnReward = repReward - contributorReward
      for (let i = 0; i < total; i++) {
        const log = tx.logs[i]
        expect(log.event).to.be.equal('ReputationScoreUpdated')
        expect(log.args._sender).to.be.equal(ctx.actors.irnNode)
        expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceIds[i])
        expect(web3.toAscii(log.args._newScore).replace(/\u0000/g, '')).to.be.equal(reputationScores[i])
        expect(log.args._contributor).to.be.equal(ctx.actors.repAuditor)
        expect(log.args._contributorReward.toString(10)).to.be.equal(contributorReward.toString(10))
        expect(log.args._irnReward.toString(10)).to.be.equal(irnReward.toString(10))

        const device = await ctx.contracts.atonomi.devices(deviceIdHashes[i])
        expect(web3.toAscii(device[0]).replace(/\u0000/g, '')).to.be.equal(hwPublicKeys[i])
        expect(web3.toAscii(device[1]).replace(/\u0000/g, '')).to.be.equal(mfgId)
        expect(device[2]).to.be.equal(true)
        expect(device[3]).to.be.equal(true)
        expect(reputationScores[i]).to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))
      }

      const irnEndingBalance = await ctx.contracts.atonomi.balances(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal((irnReward * total).toString(10))

      const repAuditorEndingBalance = await ctx.contracts.atonomi.balances(ctx.actors.repAuditor)
      expect((repAuditorEndingBalance - repAuditorStartingBalance).toString(10)).to.be.equal((contributorReward * total).toString(10))

      const claimEnding = await ctx.contracts.atonomi.balances(ctx.contracts.atonomi.address)
      expect((claimEnding - claimStarting).toString(10)).to.be.equal(((regFee + actFee - contributorReward - irnReward) * total).toString(10))

      const testWithdraws = [
        { account: ctx.actors.repAuditor, expectedTokens: contributorReward },
        { account: ctx.actors.irnNode, expectedTokens: irnReward }
      ]
      for (let i = 0; i < testWithdraws.length; i++) {
        const from = testWithdraws[i].account
        const expectTokens = testWithdraws[i].expectedTokens
        const tokenRepBefore = await ctx.contracts.token.balanceOf(from)
        const tokenAtonomiBefore = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)

        const txWithdraw = await ctx.contracts.atonomi.withdrawTokens({ from: from })
        expect(txWithdraw.logs.length).to.be.equal(1)
        expect(txWithdraw.logs[0].event).to.be.equal('TokensWithdrawn')
        expect(txWithdraw.logs[0].args._sender).to.be.equal(from)
        expect(txWithdraw.logs[0].args._amount.toString(10)).to.be.equal((expectTokens * total).toString(10))

        const tokenRepAfter = await ctx.contracts.token.balanceOf(from)
        expect((tokenRepAfter - tokenRepBefore).toString(10)).to.be.equal((expectTokens * total).toString(10))

        const tokenAtonomiAfter = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
        expect((tokenAtonomiBefore - tokenAtonomiAfter).toString(10)).to.be.equal((expectTokens * total).toString(10))
      }
    })
  })
})
