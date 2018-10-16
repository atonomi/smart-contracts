import { TestApp } from 'zos'
import { expect } from 'chai'
const DeviceManager = artifacts.require('DeviceManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Device Manager', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      storage: null,
      settings: null,
      devices: null
    }
  }

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.settings = await init.getNetworkSettingsContract(app, ctx.actors.owner)
    ctx.contracts.devices = await app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address,
      ctx.contracts.settings.address]
    )
  })

  describe('proxy cannot be initialized', () => {
    it('owner cannot be 0x0', async () => {
      const fn = app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
        0x0,
        ctx.contracts.storage.address,
        ctx.contracts.token.address,
        ctx.contracts.settings.address])
      await errors.expectRevert(fn)
    })

    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
        ctx.actors.owner,
        0x0,
        ctx.contracts.token.address,
        ctx.contracts.settings.address]
      )
      await errors.expectRevert(fn)
    })

    it('token cannot be 0x0', async () => {
      const fn = app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
        ctx.actors.owner,
        ctx.contracts.storage.address,
        0x0,
        ctx.contracts.settings.address]
      )
      await errors.expectRevert(fn)
    })

    it('settings cannot be 0x0', async () => {
      const fn = app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
        ctx.actors.owner,
        ctx.contracts.storage.address,
        ctx.contracts.token.address,
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has owner', async () => {
      const owner = await ctx.contracts.devices.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)
    })

    it('has storage', async () => {
      const storageAddr = await ctx.contracts.devices.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)
    })

    it('has token', async () => {
      const tokenAddr = await ctx.contracts.devices.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)
    })

    it('has settings', async () => {
      const settingsAddr = await ctx.contracts.devices.settings.call()
      expect(settingsAddr).to.be.equal(ctx.contracts.settings.address)
    })
  })
})
