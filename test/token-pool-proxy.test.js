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
      ctx.contracts.storage.address,
      ctx.contracts.token.address]
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
        0x0,
        ctx.contracts.token.address]
      )
      await errors.expectRevert(fn)
    })

    it('token cannot be 0x0', async () => {
      const fn = app.createProxy(TokenPool, 'TokenPool', 'initialize', [
        ctx.contracts.storage.address,
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has correct default values', async () => {
      const storageAddr = await ctx.contracts.pool.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)

      const tokenAddr = await ctx.contracts.pool.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)
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
      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, true, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it('not already an manufacturer', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, true, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it('not already an irn NODE', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, false, true, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it('token pool does not already exist', async () => {
      ctx.contracts.member.addNetworkMember(ctx.actors.alice, false, false, false, 'test_pools', {from: ctx.actors.owner})

      const hashKey = web3Utils.soliditySha3('pools', ctx.actors.alice, 'rewardAmount')
      ctx.contracts.storage.setUint(hashKey, 10)

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.alice, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it('can change wallet', async () => {
      ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})

      const result = await ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.alice, {from: ctx.actors.bob})
      expect(result).to.be.equal(true)

      const tx = await ctx.contracts.pool.changeManufacturerWallet(ctx.actors.alice, {from: ctx.actors.bob})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ManufacturerRewardWalletChanged')
      expect(tx.logs[0].args._old).to.be.equal(ctx.actors.bob)
      expect(tx.logs[0].args._new).to.be.equal(ctx.actors.alice)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal('test_pools')
    })
  })
  describe('deposit tokens', () => {
    it('manufacturer has a valid address', async () => {
      const tx = ctx.contracts.pool.depositTokens('', 20)
      await errors.expectRevert(tx)
    })
    it('does not deposit 0', async () => {
      const tx = ctx.contracts.pool.depositTokens('test-pools', 0)
      await errors.expectRevert(tx)
    })
    it('can deposit tokens', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 10, {from: ctx.actors.owner})
      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 10, { from: ctx.actors.bob })

      const tx = await ctx.contracts.pool.depositTokens(memberIdHex, 10, { from: ctx.actors.bob })

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('TokensDeposited')

      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.bob)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal('test_pools')
      expect(tx.logs[0].args._manufacturer).to.be.equal(ctx.actors.bob)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal('10')

      /*
      TODO: CHECK BALANCES
      */
    })
  })
  describe('withdraw tokens', () => {
    it('can withdraw tokens', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})
      await ctx.contracts.member.addNetworkMember(ctx.actors.irnNode, false, false, true, 'test_irn', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 100 * multiplier, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.irnNode, 100 * multiplier, {from: ctx.actors.owner})

      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.pool.depositTokens(memberIdHex, regFee + actFee, {from: ctx.actors.bob})

      await ctx.contracts.token.contract.approve(ctx.contracts.device.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.device.registerAndActivateDevice('Test_Device_1', 'Test_Type', 'Test_Key', {from: ctx.actors.bob})

      await ctx.contracts.reputation.updateReputationScore(web3Utils.toHex('Test_Device_1'), '5555-5-5', {from: ctx.actors.irnNode})

      let tx = await ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})

      expect(tx.logs.length).to.be.equal(1)
      let log = tx.logs[0]
      expect(log.event).to.be.equal('TokensWithdrawn')
      expect(log.args._sender).to.be.equal(ctx.actors.irnNode)
      expect(log.args._amount.toString(10)).to.be.equal('400')

      tx = await ctx.contracts.pool.withdrawTokens({from: ctx.actors.bob})

      expect(tx.logs.length).to.be.equal(1)
      log = tx.logs[0]
      expect(log.event).to.be.equal('TokensWithdrawn')
      expect(log.args._sender).to.be.equal(ctx.actors.bob)
      expect(log.args._amount.toString(10)).to.be.equal('600')

      let balanceBob = await ctx.contracts.token.balanceOf(ctx.actors.bob)
      expect(balanceBob.toString(10)).to.be.equal('96600')
      let balanceIrn = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect(balanceIrn.toString(10)).to.be.equal('100400')

      /*
      TODO: CHECK BALANCES
      */
    })
    it('does not withdraw twice', async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})
      await ctx.contracts.member.addNetworkMember(ctx.actors.irnNode, false, false, true, 'test_irn', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 100 * multiplier, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.irnNode, 100 * multiplier, {from: ctx.actors.owner})

      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.pool.depositTokens(memberIdHex, regFee + actFee, {from: ctx.actors.bob})

      await ctx.contracts.token.contract.approve(ctx.contracts.device.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.device.registerAndActivateDevice('Test_Device_1', 'Test_Type', 'Test_Key', {from: ctx.actors.bob})

      await ctx.contracts.reputation.updateReputationScore(web3Utils.toHex('Test_Device_1'), '5555-5-5', {from: ctx.actors.irnNode})

      await ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})

      // attempt withdraw again
      const doubleDip = ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})

      await errors.expectRevert(doubleDip)
    })
  })
})
