import { TestApp } from 'zos'
import { expect } from 'chai'
const NetworkSettings = artifacts.require('NetworkSettings')
const DeviceManager = artifacts.require('DeviceManager')
const TokenPool = artifacts.require('TokenPool')
const NetworkMemberManager = artifacts.require('NetworkMemberManager')
const ReputationManager = artifacts.require('ReputationManager')
const web3Utils = require('web3-utils')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Token Pool', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      device: null,
      settings: null,
      storage: null,
      member: null,
      pool: null,
      token: null,
      reputation: null
    }
  }

  const tokenDecimals = 3
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.pool = await app.createProxy(TokenPool, 'TokenPool', 'initialize', [
      ctx.contracts.storage.address]
    )
    ctx.contracts.member = await app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address
    ])
    ctx.contracts.reputation = await app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address
    ])
    ctx.contracts.settings = await app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
      ctx.actors.owner,
      regFee,
      actFee,
      repReward,
      40,
      1,
      ctx.contracts.storage.address
    ])
    ctx.contracts.device = await app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address,
      ctx.contracts.settings.address
    ])

    await ctx.contracts.member.addNetworkMember(ctx.actors.mfg, false, true, false, 'pool_test', {from: ctx.actors.owner})
  })

  describe('proxy cannot be initialized', () => {
    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(TokenPool, 'TokenPool', 'initialize', [
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has correct default values', async () => {
      const storageAddr = await ctx.contracts.pool.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)
    })
  })

  describe('sets token pool reward', () => {
    it('does not set 0', async () => {
      const tx = ctx.contracts.pool.setTokenPoolReward(0, {from: ctx.actors.mfg})
      await errors.expectRevert(tx)
    })

    it('sets new reward', async () => {
      const tx = await ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('TokenPoolRewardUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[0].args._newReward.toString(10)).to.be.equal('10')

      const hashKey = web3Utils.soliditySha3('pools', ctx.actors.mfg, 'rewardAmount')
      const poolValue = await ctx.contracts.storage.getUint(hashKey)
      expect(poolValue.toString(10)).to.be.equal('10')
    })

    it('does not set same reward as previously set', async () => {
      await ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})

      const tx = ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})
      await errors.expectRevert(tx)
    })
  })

  describe('change manufacturer wallet', () => {
    it('new address cannot be 0x0', async () => {
      const fn = ctx.contracts.pool.changeManufacturerWallet(0x0, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })

    it('not already an admin', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, true, false, false, 'test_new', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.bob, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })

    it('not already an manufacturer', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_new', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.bob, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })

    it('not already an irn NODE', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, false, true, 'test_new', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.bob, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })

    it('can change wallet', async () => {
      // fund existing mfg with some tokens
      await ctx.contracts.token.approve(ctx.contracts.device.address, regFee, {from: ctx.actors.owner})
      await ctx.contracts.device.depositTokens('pool_test', regFee, {from: ctx.actors.owner})

      const result = await ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.bob, {from: ctx.actors.mfg})
      expect(result).to.be.equal(true)

      const tx = await ctx.contracts.pool.changeManufacturerWallet(ctx.actors.bob, {from: ctx.actors.mfg})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ManufacturerRewardWalletChanged')
      expect(tx.logs[0].args._old).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[0].args._new).to.be.equal(ctx.actors.bob)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal('pool_test')

      // check copied permissions
      expect(await ctx.contracts.member.isManufacturer(ctx.actors.mfg)).to.be.equal(false)
      expect(await ctx.contracts.member.isIRNNode(ctx.actors.mfg)).to.be.equal(false)
      expect(await ctx.contracts.member.isIRNAdmin(ctx.actors.mfg)).to.be.equal(false)
      const oldMemberId = await ctx.contracts.member.memberId(ctx.actors.mfg)
      expect(web3.toAscii(oldMemberId).replace(/\u0000/g, '')).to.be.equal('')

      expect(await ctx.contracts.member.isManufacturer(ctx.actors.bob)).to.be.equal(true)
      expect(await ctx.contracts.member.isIRNNode(ctx.actors.bob)).to.be.equal(false)
      expect(await ctx.contracts.member.isIRNAdmin(ctx.actors.bob)).to.be.equal(false)
      const newMemberId = await ctx.contracts.member.memberId(ctx.actors.bob)
      expect(web3.toAscii(newMemberId).replace(/\u0000/g, '')).to.be.equal('pool_test')

      // check copied balances
      const oldPool = await ctx.contracts.pool.poolBalance(ctx.actors.mfg)
      expect(oldPool.toString(10)).to.be.equal('0')

      const newPool = await ctx.contracts.pool.poolBalance(ctx.actors.bob)
      expect(newPool.toString(10)).to.be.equal(regFee.toString(10))

      // check copied reward amounts
      const oldRewardAmount = await ctx.contracts.pool.poolRewardAmount(ctx.actors.mfg)
      expect(oldRewardAmount.toString(10)).to.be.equal('0')

      const newRewardAmount = await ctx.contracts.pool.poolRewardAmount(ctx.actors.bob)
      expect(newRewardAmount.toString(10)).to.be.equal(repReward.toString(10))
    })
  })
})
