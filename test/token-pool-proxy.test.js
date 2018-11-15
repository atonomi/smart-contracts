import { TestApp } from 'zos'
import { expect } from 'chai'
import { createContext } from 'vm';
const TokenPool = artifacts.require('TokenPool')
const NetworkMemberManager = artifacts.require('NetworkMemberManager')
const web3Utils = require('web3-utils')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Token Pool', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      storage: null,
      member: null,
      pool: null,
      token: null
    }
  }

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
  describe('change manufacturer wallet', () => {

    it("new address cannot be 0x0", async () => {

      const fn = ctx.contracts.pool.changeManufacturerWallet.call(0x0, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    
    it("must be a manufacturer", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("not already an admin", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, true, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("not already an manufacturer", async () => {

      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, true, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("not already an irn NODE", async () => {
      
      await ctx.contracts.member.addNetworkMember(ctx.actors.admin, false, false, true, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.admin, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
    it("token pool doesn't already exist", async () => {

      ctx.contracts.member.addNetworkMember(ctx.actors.alice, false, false, false, 'test_pools', {from: ctx.actors.owner})

      const fn = ctx.contracts.pool.changeManufacturerWallet.call(ctx.actors.alice, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)

    })
  })


})
