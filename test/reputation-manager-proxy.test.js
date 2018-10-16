import { TestApp } from 'zos'
import { expect } from 'chai'
const ReputationManager = artifacts.require('ReputationManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Reputation Manager', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      storage: null,
      reputation: null
    }
  }

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.reputation = await app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address]
    )
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
    it('has owner', async () => {
      const owner = await ctx.contracts.reputation.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)
    })

    it('is not paused', async () => {
      const paused = await ctx.contracts.reputation.paused.call()
      expect(paused).to.be.equal(false)
    })

    it('has storage', async () => {
      const storageAddr = await ctx.contracts.reputation.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)
    })

    it('has token', async () => {
      const tokenAddr = await ctx.contracts.reputation.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)
    })
  })
})
