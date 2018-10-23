import { TestApp } from 'zos'
import { expect } from 'chai'
const TokenPool = artifacts.require('TokenPool')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Token Pool', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      storage: null,
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
})
