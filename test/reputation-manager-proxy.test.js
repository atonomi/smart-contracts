import { TestHelper } from 'zos'
import { expect } from 'chai'
import { mineBlock } from './helpers/mine'
const ReputationManager = artifacts.require('ReputationManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')
const web3Utils = require('web3-utils')

contract('Reputation Manager', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      storage: null,
      reputation: null,
      members: null
    }
  }

  beforeEach(async () => {
    app = await TestHelper({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.settings = await init.getNetworkSettingsContract(app, ctx.actors.owner, ctx.contracts.storage.address)
    ctx.contracts.members = await init.getNetworkMemberContract(app, ctx.actors.owner, ctx.contracts.storage.address)
    ctx.contracts.reputation = await init.getReputationManagerContract(app, ctx.actors.owner, ctx.contracts.storage.address, ctx.contracts.token.address)
    ctx.contracts.devices = await init.getDevicesContract(
      app,
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address,
      ctx.contracts.settings.address)
  })

  describe('proxy cannot be initialized', () => {
    it('owner cannot be 0x0', async () => {
      const fn = app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
        0x0,
        ctx.contracts.storage.address,
        ctx.contracts.token.address]
      )
      await errors.expectRevert(fn)
    })

    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
        ctx.actors.owner,
        0x0,
        ctx.contracts.token.address]
      )
      await errors.expectRevert(fn)
    })

    it('token cannot be 0x0', async () => {
      const fn = app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
        ctx.actors.owner,
        ctx.contracts.storage.address,
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has correct default values', async () => {
      const owner = await ctx.contracts.reputation.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)

      const paused = await ctx.contracts.reputation.paused.call()
      expect(paused).to.be.equal(false)

      const storageAddr = await ctx.contracts.reputation.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)

      const tokenAddr = await ctx.contracts.reputation.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)
    })
  })

  describe('update reputation', () => {
    let irnStartingBalance
    let mfgStartingBalance
    let poolStartingBalance

    const tokenDecimals = 18
    const multiplier = 10 ** tokenDecimals
    const regFee = 1 * multiplier
    const actFee = 1 * multiplier
    const repReward = 1 * multiplier

    const mfgId = 'FIL'
    const deviceId = 'FILDEVICE1'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
    const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
    const defaultRep = '6767-1-1'

    beforeEach(async () => {
      // record initial balances
      irnStartingBalance = await ctx.contracts.reputation.rewards(ctx.actors.irnNode)
      mfgStartingBalance = await ctx.contracts.reputation.rewards(ctx.actors.mfg)
      poolStartingBalance = await ctx.contracts.reputation.poolBalance(ctx.actors.mfg)

      // fund manufacturer with ATMI
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // register and activate a device
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      // onboard IRN node
      await ctx.contracts.members.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
    })

    it('can update score', async () => {
      const score = '7575-1-1'

      const success = await ctx.contracts.reputation.updateReputationScore.call(deviceId, score, {from: ctx.actors.irnNode})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.reputation.updateReputationScore(deviceId, score, {from: ctx.actors.irnNode})

      // check emitted reputation logs
      const irnReward = repReward * 0.20
      const mfgReward = repReward - irnReward
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('ReputationScoreUpdated')
      expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)
      expect(web3.toAscii(log.args._deviceType).replace(/\u0000/g, '')).to.be.equal(deviceType)
      expect(web3.toAscii(log.args._newScore).replace(/\u0000/g, '')).to.be.equal(score)
      expect(log.args._irnNode).to.be.equal(ctx.actors.irnNode)
      expect(log.args._irnReward.toString(10)).to.be.equal(irnReward.toString(10))
      expect(log.args._manufacturerWallet).to.be.equal(ctx.actors.mfg)
      expect(log.args._manufacturerReward.toString(10)).to.be.equal(mfgReward.toString(10))

      // confirm storage of data
      const deviceMfgIdKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'manufacturerId')
      const deviceMfgId = await ctx.contracts.storage.getBytes32(deviceMfgIdKey)
      expect(web3.toAscii(deviceMfgId).replace(/\u0000/g, '')).to.be.equal(mfgId)

      const deviceDeviceTypeKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'deviceType')
      const deviceDeviceType = await ctx.contracts.storage.getBytes32(deviceDeviceTypeKey)
      expect(web3.toAscii(deviceDeviceType).replace(/\u0000/g, '')).to.be.equal(deviceType)

      const deviceRegisteredKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'registered')
      const deviceRegistered = await ctx.contracts.storage.getBool(deviceRegisteredKey)
      expect(deviceRegistered).to.be.equal(true)

      const deviceActivetedKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'activated')
      const deviceActivated = await ctx.contracts.storage.getBool(deviceActivetedKey)
      expect(deviceActivated).to.be.equal(true)

      const deviceDeviceScoreKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'reputationScore')
      const deviceDeviceScore = await ctx.contracts.storage.getBytes32(deviceDeviceScoreKey)
      expect(web3.toAscii(deviceDeviceScore).replace(/\u0000/g, '')).to.be.equal(score)

      const devicePublicKeyKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'devicePublicKey')
      const deviceDevicePublicKey = await ctx.contracts.storage.getBytes32(devicePublicKeyKey)
      expect(deviceDevicePublicKey).to.be.equal(devicePublicKey)

      // confirm block number recorded for reward depreciation
      const blockNumber = await ctx.contracts.reputation.authorWrites(ctx.actors.irnNode, deviceId)
      expect(blockNumber.toString(10)).to.be.equal(web3.eth.blockNumber.toString(10))

      // reconcile balances
      const irnEndingBalance = await ctx.contracts.reputation.rewards(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal(irnReward.toString(10))

      const mfgEndingBalance = await ctx.contracts.reputation.rewards(ctx.actors.mfg)
      expect((mfgEndingBalance - mfgStartingBalance).toString(10)).to.be.equal(mfgReward.toString(10))

      const poolEndingBalance = await ctx.contracts.reputation.poolBalance(ctx.actors.mfg)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal(repReward.toString(10))
    })

    it('can not set score for device that is not activated', async () => {
      // fund mfg for an additional registration
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee, {from: ctx.actors.owner})

      // register a different device, but dont activate
      const newDeviceId = 'FILDEVICE2'
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee, {from: ctx.actors.mfg})
      await ctx.contracts.devices.registerDevice(newDeviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      const score = '6666-1-1'
      const fn = ctx.contracts.reputation.updateReputationScore(newDeviceId, score, {from: ctx.actors.irnNode})
      await errors.expectRevert(fn)
    })

    it('immediate score update should yeild small reward', async () => {
      // perform the first score update
      const firstScore = '7575-1-1'
      await ctx.contracts.reputation.updateReputationScore(deviceId, firstScore, {from: ctx.actors.irnNode})
      const initialReward = await ctx.contracts.reputation.rewards(ctx.actors.irnNode)

      // simulate time passing by mining some blocks
      await mineBlock()
      await mineBlock()

      // perform the second score update
      const secondScore = '7676-1-1'
      await ctx.contracts.reputation.updateReputationScore(deviceId, secondScore, {from: ctx.actors.irnNode})
      const finalReward = await ctx.contracts.reputation.rewards(ctx.actors.irnNode)

      const myNewReward = finalReward - initialReward
      expect(myNewReward.toString(10)).to.be.equal('104166666666656')
    })

    it('external accounts can not set', async () => {
      const score = '6666-1-1'
      const bads = [ctx.actors.owner, ctx.actors.admin, ctx.actors.deviceOwner, ctx.actors.mfg, ctx.actors.alice]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        const fn = ctx.contracts.reputation.updateReputationScore(deviceId, score, {from: from})
        await errors.expectRevert(fn)
      }
    })
  })
})
