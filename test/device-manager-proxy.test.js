import { TestApp } from 'zos'
import { expect } from 'chai'
const DeviceManager = artifacts.require('DeviceManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')
const web3Utils = require('web3-utils')
const ethjsABI = require('ethjs-abi')

contract('Device Manager', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      storage: null,
      settings: null,
      reputation: null,
      members: null,
      devices: null
    }
  }

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const defaultRep = '6767-1-1'

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.settings = await init.getNetworkSettingsContract(app, ctx.actors.owner, ctx.contracts.storage.address)
    ctx.contracts.reputation = await init.getReputationManagerContract(app, ctx.actors.owner, ctx.contracts.storage.address, ctx.contracts.token.address)
    ctx.contracts.members = await init.getNetworkMemberContract(app, ctx.actors.owner, ctx.contracts.storage.address)
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
    it('has correct default values', async () => {
      const owner = await ctx.contracts.devices.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)

      const storageAddr = await ctx.contracts.devices.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)

      const tokenAddr = await ctx.contracts.devices.token.call()
      expect(tokenAddr).to.be.equal(ctx.contracts.token.address)

      const settingsAddr = await ctx.contracts.devices.settings.call()
      expect(settingsAddr).to.be.equal(ctx.contracts.settings.address)

      const paused = await ctx.contracts.devices.paused.call()
      expect(paused).to.be.equal(false)
    })
  })

  describe('register devices', () => {
    const mfgId = 'FIL'
    const deviceId = 'FILDEVICE1'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
    const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})

    let poolStartingBalance
    let mfgStartingBalance

    beforeEach(async () => {
      // fund device owner and manufacturers with ATMI
      await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // mfg grants erc token transfer for registration
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee, { from: ctx.actors.mfg })

      // record initial balances
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      poolStartingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
    })

    it('can register a device', async () => {
      const success = await ctx.contracts.devices.registerDevice.call(deviceIdHash, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      // confirm emitted logs for registration
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args._fee.toString(10)).to.be.equal(regFee.toString(10))
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)
      expect(web3.toAscii(log.args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)
      expect(web3.toAscii(log.args._deviceType).replace(/\u0000/g, '')).to.be.equal(deviceType)

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
      expect(deviceActivated).to.be.equal(false)

      const deviceDeviceScoreKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'reputationScore')
      const deviceDeviceScore = await ctx.contracts.storage.getBytes32(deviceDeviceScoreKey)
      expect(web3.toAscii(deviceDeviceScore).replace(/\u0000/g, '')).to.be.equal(defaultRep)

      const devicePublicKeyKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'devicePublicKey')
      const deviceDevicePublicKey = await ctx.contracts.storage.getBytes32(devicePublicKeyKey)
      expect(deviceDevicePublicKey).to.be.equal(devicePublicKey)

      // confirm emitted logs for token payment
      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.devices.address)
      expect(tokenLog.value.toString(10)).to.be.equal(regFee.toString(10))

      // reconcile balances
      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const poolEndingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal(regFee.toString(10))
    })
  })
})
