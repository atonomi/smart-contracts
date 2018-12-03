import { TestHelper } from 'zos'
import { expect } from 'chai'
const NetworkSettings = artifacts.require('NetworkSettings')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Network Settings', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      settings: null,
      storage: null
    }
  }

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier
  const repShare = 20
  const blockThreshold = 5760

  beforeEach(async () => {
    app = await TestHelper({ from: ctx.actors.owner })

    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)

    ctx.contracts.settings = await init.getNetworkSettingsContract(app, ctx.actors.owner, ctx.contracts.storage.address)
  })
  describe('proxy cannot be initialized', () => {
    it('owner cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        0x0,
        regFee, actFee,
        repReward, repShare, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('regFee cannot be 0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        0, actFee,
        repReward, repShare, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('actFee cannot be 0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        regFee, 0,
        repReward, repShare, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('repReward cannot be 0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        regFee, actFee,
        0, repShare, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('repShare must be greater than 0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        regFee, actFee,
        repReward, 0, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('repShare must be less than 100', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        regFee, actFee,
        repReward, 100, blockThreshold, ctx.contracts.storage.address])
      await errors.expectRevert(fn)
    })

    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
        ctx.actors.owner,
        regFee, actFee,
        repReward, repShare, blockThreshold, 0x0])
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has correct default values', async () => {
      const owner = await ctx.contracts.settings.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)

      const actRegFee = await ctx.contracts.settings.registrationFee.call()
      expect(actRegFee.toString(10)).to.be.equal(regFee.toString(10))

      const actActFee = await ctx.contracts.settings.activationFee.call()
      expect(actActFee.toString(10)).to.be.equal(actFee.toString(10))

      const reward = await ctx.contracts.settings.defaultReputationReward.call()
      expect(reward.toString(10)).to.be.equal(repReward.toString(10))

      const share = await ctx.contracts.settings.reputationIRNNodeShare.call()
      expect(share.toString(10)).to.be.equal(repShare.toString(10))

      const threshold = await ctx.contracts.settings.blockThreshold.call()
      expect(threshold.toString(10)).to.be.equal(blockThreshold.toString(10))
    })
  })

  describe('registration fees', () => {
    const newRegFee = regFee * 2

    it('owner can set fee', async () => {
      const success = await ctx.contracts.settings.setRegistrationFee.call(newRegFee, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.settings.setRegistrationFee(newRegFee, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('RegistrationFeeUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRegFee.toString(10))

      const fee = await ctx.contracts.settings.registrationFee()
      expect(fee.toString(10)).to.be.equal(newRegFee.toString(10))
    })

    it('can not set fee to 0', async () => {
      const fn = ctx.contracts.settings.setRegistrationFee(0, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('can not set fee to same value', async () => {
      const fn = ctx.contracts.settings.setRegistrationFee(regFee, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('external accounts cannot set fee', async () => {
      const fn = ctx.contracts.settings.setRegistrationFee(newRegFee, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('activation fees', () => {
    const newActFee = actFee * 2

    it('owner can set fee', async () => {
      const success = await ctx.contracts.settings.setActivationFee.call(newActFee, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.settings.setActivationFee(newActFee, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ActivationFeeUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newActFee.toString(10))

      const fee = await ctx.contracts.settings.activationFee()
      expect(fee.toString(10)).to.be.equal(newActFee.toString(10))
    })

    it('can not set fee to 0', async () => {
      const fn = ctx.contracts.settings.setActivationFee(0, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('can not set fee to same value', async () => {
      const fn = ctx.contracts.settings.setActivationFee(actFee, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('external accounts cannot set fee', async () => {
      const fn = ctx.contracts.settings.setActivationFee(newActFee, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('default reputation reward', () => {
    const newRepReward = repReward * 2

    it('owner can set default reward', async () => {
      const success = await ctx.contracts.settings.setDefaultReputationReward.call(newRepReward, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.settings.setDefaultReputationReward(newRepReward, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('DefaultReputationRewardUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRepReward.toString(10))

      const fee = await ctx.contracts.settings.defaultReputationReward()
      expect(fee.toString(10)).to.be.equal(newRepReward.toString(10))
    })

    it('can not set fee to 0', async () => {
      const fn = ctx.contracts.settings.setDefaultReputationReward(0, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('can not set fee to same value', async () => {
      const fn = ctx.contracts.settings.setDefaultReputationReward(repReward, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('external accounts cannot set default reward', async () => {
      const fn = ctx.contracts.settings.setDefaultReputationReward(newRepReward, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('reward split', () => {
    const newShare = 50

    it('owner can set reward', async () => {
      const success = await ctx.contracts.settings.setReputationIRNNodeShare.call(newShare, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.settings.setReputationIRNNodeShare(newShare, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ReputationIRNNodeShareUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._percentage.toString(10)).to.be.equal(newShare.toString(10))
    })

    it('can not set share to 0%', async () => {
      const fn = ctx.contracts.settings.setReputationIRNNodeShare(0, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('can not set share 100% or more', async () => {
      const fn = ctx.contracts.settings.setReputationIRNNodeShare(100, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('can not set share to same value', async () => {
      const fn = ctx.contracts.settings.setReputationIRNNodeShare(repShare, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })

    it('external accounts cannot set split', async () => {
      const fn = ctx.contracts.settings.setReputationIRNNodeShare(newShare, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('block threshold', () => {
    it('owner can set threshold', async () => {
      const newBlockThreshold = 240
      const success = await ctx.contracts.settings.setRewardBlockThreshold.call(newBlockThreshold, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.settings.setRewardBlockThreshold(newBlockThreshold, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('RewardBlockThresholdChanged')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._newBlockThreshold.toString(10)).to.be.equal(newBlockThreshold.toString(10))

      const threshold = await ctx.contracts.settings.blockThreshold()
      expect(threshold.toString(10)).to.be.equal(newBlockThreshold.toString(10))
    })

    it('can not set threshold to same value', async () => {
      const fn = ctx.contracts.settings.setRewardBlockThreshold(blockThreshold, {from: ctx.actors.owner})
      await errors.expectRevert(fn)
    })
  })
})
