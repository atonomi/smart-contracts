import { TestApp } from 'zos'
import { expect } from 'chai'
import { createContext } from 'vm';
import { SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION } from 'constants';
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

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier

  const defaultRep = '6767-1-1'
  const deviceId = 'apple-iphone1'
  const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
  const mfgId = 'APPLE'
  const deviceType = 'phone'
  const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
  
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
    ctx.contracts.reputation = await app.createProxy(ReputationManager, "ReputationManager", 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address
    ])
    ctx.contracts.settings = await app.createProxy(NetworkSettings, "NetworkSettings", "initialize", [
      ctx.actors.owner,
      regFee,
      actFee,
      repReward,
      50,
      1,
      ctx.contracts.storage.address
    ])
    ctx.contracts.device = await app.createProxy(DeviceManager, "DeviceManager", "initialize", [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address,
      ctx.contracts.settings.address
    ])

    await ctx.contracts.member.addNetworkMember(ctx.actors.mfg, false, true, false, "pool_test", {from: ctx.actors.owner})
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
    it('has storage', async () => {
      const storageAddr = await ctx.contracts.pool.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)

      const tokenAddr = await ctx.contracts.pool.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)
    })
  })

  describe('sets token pool reward', () => {
    it("doesn't set 0", async () => {
      const tx = ctx.contracts.pool.setTokenPoolReward(0, {from: ctx.actors.mfg})
      await errors.expectRevert(tx)
    })
    it("sets new reward", async () => {
      const tx = await  ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('TokenPoolRewardUpdated')
    })
    it("doesn't set same reward as previously set", async () => {
      await ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})
      
      const tx = ctx.contracts.pool.setTokenPoolReward(10, {from: ctx.actors.mfg})
      await errors.expectRevert(tx)
    })
  })

  describe('change manufacturer wallet', () => {
    
    it("new address cannot be 0x0", async () => {

      const fn = ctx.contracts.pool.changeManufacturerWallet(0x0, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    
    it("must be a manufacturer", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
    it("not already an admin", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, true, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("not already an manufacturer", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, true, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("not already an irn NODE", async () => {
      
      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, false, true, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("token pool doesn't already exist", async () => {

      ctx.contracts.member.addNetworkMember(ctx.actors.alice, false, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.alice, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)

    })
    it("can change wallet", async () => {
      ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})

      const result = await ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.alice, {from: ctx.actors.bob})
      expect(result).to.be.equal(true)
    })
  })

  describe('set token pool reward', () => {
    it("new reward must be specified", async () => {

    })
    it("new reward must be different", async () => {

    })
    it("new reward is set", async () => {

    })
  })
  
  describe('deposit tokens', () => {
    
    it("manufacturer has a valid address", async () => {
        const fn = ctx.contracts.pool.depositTokens.call('', 20)
        await errors.expectRevert(fn);
    })
    it("doesn't deposit 0", async () => {
      const fn = ctx.contracts.pool.depositTokens.call(ctx.actors.mfg, 0)
      await errors.expectRevert(fn);
    })
    it("doesn't deposit negative amount", async () => {
      const fn = ctx.contracts.pool.depositTokens.call(ctx.actors.mfg, -1)
      await errors.expectRevert(fn);
    })
    it("can deposit tokens", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 10), {from: ctx.actors.owner};
      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 10, { from: ctx.actors.bob })

      const tx = await ctx.contracts.pool.depositTokens(memberIdHex, 10, {from: ctx.actors.bob})
      
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('TokensDeposited')
    })
    
  })

  
  describe('withdraw tokens', () => {

    it("can withdraw tokens", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})
      await ctx.contracts.member.addNetworkMember(ctx.actors.irnNode, false, false, true, 'test_irn', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 100 * multiplier, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.irnNode, 100 * multiplier, {from: ctx.actors.owner})

      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.pool.depositTokens(memberIdHex, regFee + actFee, {from: ctx.actors.bob})
      
      await ctx.contracts.token.contract.approve(ctx.contracts.device.address, 100 * multiplier, {from: ctx.actors.bob })
      
      await ctx.contracts.device.registerAndActivateDevice("Test_Device_1", "Test_Type", "Test_Key", {from: ctx.actors.bob})

      await ctx.contracts.reputation.updateReputationScore(web3Utils.toHex("Test_Device_1"), "5555-5-5", {from: ctx.actors.irnNode})
      
      const tx = await ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})
      
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('TokensWithdrawn')
    })
    it("doesn't withdraw twice", async () => {
      await ctx.contracts.member.addNetworkMember(ctx.actors.bob, false, true, false, 'test_pools', {from: ctx.actors.owner})
      await ctx.contracts.member.addNetworkMember(ctx.actors.irnNode, false, false, true, 'test_irn', {from: ctx.actors.owner})

      await ctx.contracts.token.transfer(ctx.actors.bob, 100 * multiplier, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.irnNode, 100 * multiplier, {from: ctx.actors.owner})

      let memberId = await ctx.contracts.member.memberId(ctx.actors.bob)

      let memberIdHex = web3Utils.toHex(memberId)

      await ctx.contracts.token.approve(ctx.contracts.pool.address, 100 * multiplier, { from: ctx.actors.bob })

      await ctx.contracts.pool.depositTokens(memberIdHex, regFee + actFee, {from: ctx.actors.bob})
      
      await ctx.contracts.token.contract.approve(ctx.contracts.device.address, 100 * multiplier, {from: ctx.actors.bob })
      
      await ctx.contracts.device.registerAndActivateDevice("Test_Device_1", "Test_Type", "Test_Key", {from: ctx.actors.bob})

      await ctx.contracts.reputation.updateReputationScore(web3Utils.toHex("Test_Device_1"), "5555-5-5", {from: ctx.actors.irnNode})
      
      await ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})
      
      //attempt withdraw again
      const doubleDip = ctx.contracts.pool.withdrawTokens({from: ctx.actors.irnNode})

      await errors.expectRevert(doubleDip)
    })
  })
})
