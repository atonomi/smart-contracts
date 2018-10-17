import { TestApp } from 'zos'
import { expect } from 'chai'
const NetworkMemberManager = artifacts.require('NetworkMemberManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Network Member', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      storage: null,
      members: null
    }
  }

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.members = await init.getNetworkMemberContract(app, ctx.actors.owner, ctx.contracts.storage.address)
  })

  describe('proxy cannot be initialized', () => {
    it('owner cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
        0x0,
        ctx.contracts.storage.address]
      )
      await errors.expectRevert(fn)
    })

    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
        ctx.actors.owner,
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has owner', async () => {
      const owner = await ctx.contracts.members.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)
    })

    it('has storage', async () => {
      const storageAddr = await ctx.contracts.members.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)
    })
  })
})
