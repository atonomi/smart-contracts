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
  const repReward = 1 * multiplier
  const irnReward = repReward * 0.20
  const mfgReward = repReward - irnReward

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.settings = await init.getNetworkSettingsContract(app, ctx.actors.owner, ctx.contracts.storage.address)
    ctx.contracts.reputation = await init.getReputationManagerContract(app, ctx.actors.owner, ctx.contracts.storage.address, ctx.contracts.token.address)
    ctx.contracts.members = await init.getNetworkMemberContract(app, ctx.actors.owner, ctx.contracts.storage.address)
    ctx.contracts.devices = await init.getDevicesContract(
      app,
      ctx.actors.owner,
      ctx.contracts.storage.address,
      ctx.contracts.token.address,
      ctx.contracts.settings.address)
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
      // fund manufacturer with ATMI
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee, {from: ctx.actors.owner})

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

    it('external accounts can not register', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee, {from: from})
        const fn = ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register device that is already registered', async () => {
      // register device first
      const from = ctx.actors.mfg
      await ctx.contracts.token.approve(ctx.contracts.devices.address, 2 * regFee, {from: from})
      await ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: from})

      const fn = ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: from})
      await errors.expectRevert(fn)
    })

    it('can not register with insufficent funds', async () => {
      // remove funds from mfg wallet
      const from = ctx.actors.mfg
      await ctx.contracts.token.transfer(ctx.actors.alice, regFee, {from: from})
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee, { from: from })

      const fn = ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: from})
      await errors.expectRevert(fn)
    })
  })

  describe('activate devices', () => {
    const mfgId = 'FIL'
    const deviceId = 'FILDEVICE1'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
    const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})

    let poolStartingBalance
    let deviceOwnerStartingBalance

    beforeEach(async () => {
      // fund device owner and manufacturers with ATMI
      await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee, {from: ctx.actors.owner})

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // mfg grants erc token transfer for registration and registers a device
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.devices.registerDevice(deviceIdHash, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      // device owner grants erc token transfer for activation
      await ctx.contracts.token.approve(ctx.contracts.devices.address, actFee, { from: ctx.actors.deviceOwner })

      // record initial balances
      deviceOwnerStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      poolStartingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
    })

    it('device owner can activate', async () => {
      const success = await ctx.contracts.devices.activateDevice.call(deviceId, {from: ctx.actors.deviceOwner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.devices.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      // confirm emitted activation log
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceActivated')
      expect(log.args._sender).to.be.equal(ctx.actors.deviceOwner)
      expect(log.args._fee.toString(10)).to.be.equal(actFee.toString(10))
      expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)
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
      expect(deviceActivated).to.be.equal(true)

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
      expect(tokenLog.from).to.be.equal(ctx.actors.deviceOwner)
      expect(tokenLog.to).to.be.equal(ctx.contracts.devices.address)
      expect(tokenLog.value.toString(10)).to.be.equal(actFee.toString(10))

      // reconcile balances
      const deviceOwnerEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      expect((deviceOwnerStartingBalance - deviceOwnerEndingBalance).toString(10)).to.be.equal(actFee.toString(10))

      const poolEndingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal(actFee.toString(10))
    })

    it('persons without the device can not activate (not registered)', async () => {
      const wrongDeviceId = 'samsung-microwave1'
      await ctx.contracts.token.approve(ctx.contracts.devices.address, actFee, { from: ctx.actors.deviceOwner })
      const fn = ctx.contracts.devices.activateDevice(wrongDeviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate device that is already activated', async () => {
      await ctx.contracts.devices.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      // transfer more funds and try to activate again
      await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
      await ctx.contracts.token.approve(ctx.contracts.devices.address, actFee, { from: ctx.actors.deviceOwner })

      const fn = ctx.contracts.devices.activateDevice(deviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate with insufficent funds', async () => {
      // alice has no funds
      await ctx.contracts.token.approve(ctx.contracts.devices.address, actFee, { from: ctx.actors.alice })
      const fn = ctx.contracts.devices.activateDevice(deviceId, {from: ctx.actors.alice})
      await errors.expectRevert(fn)
    })
  })

  describe('register and activate devices', () => {
    const mfgId = 'FIL'
    const deviceId = 'FILDEVICE1'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'
    const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})

    let poolStartingBalance
    let mfgStartingBalance

    beforeEach(async () => {
      // fund device owner and manufacturers with ATMI
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // mfg grants erc token transfer for registration and activation
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee + actFee, { from: ctx.actors.mfg })

      // record initial balances
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      poolStartingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
    })

    it('can register and activate device', async () => {
      const success = await ctx.contracts.devices.registerAndActivateDevice.call(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      // confirm emitted device logs
      expect(tx.logs.length).to.be.equal(2)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args._fee.toString(10)).to.be.equal(regFee.toString(10))
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)
      expect(web3.toAscii(log.args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)
      expect(web3.toAscii(log.args._deviceType).replace(/\u0000/g, '')).to.be.equal(deviceType)

      const log1 = tx.logs[1]
      expect(log1.event).to.be.equal('DeviceActivated')
      expect(log1.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args._fee.toString(10)).to.be.equal(actFee.toString(10))
      expect(web3.toAscii(log1.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)
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
      expect(deviceActivated).to.be.equal(true)

      const deviceDeviceScoreKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'reputationScore')
      const deviceDeviceScore = await ctx.contracts.storage.getBytes32(deviceDeviceScoreKey)
      expect(web3.toAscii(deviceDeviceScore).replace(/\u0000/g, '')).to.be.equal(defaultRep)

      const devicePublicKeyKey = await ctx.contracts.devices.getDeviceStorageKey(deviceIdHash, 'devicePublicKey')
      const deviceDevicePublicKey = await ctx.contracts.storage.getBytes32(devicePublicKeyKey)
      expect(deviceDevicePublicKey).to.be.equal(devicePublicKey)

      // confirm emitted logs for token payment
      expect(tx.receipt.logs.length).to.be.equal(3)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.devices.address)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee + actFee).toString(10))

      // reconcile balances
      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))

      const poolEndingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('external accounts can not register and activate device', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.approve(ctx.contracts.devices.address, (regFee + actFee), {from: from})
        const fn = ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register and activate device that is already registered', async () => {
      const from = ctx.actors.mfg

      // register device first
      await ctx.contracts.token.transfer(ctx.actors.mfg, 2 * (regFee + actFee), {from: ctx.actors.owner})
      await ctx.contracts.token.approve(ctx.contracts.devices.address, 2 * (regFee + actFee), {from: from})
      await ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: from})

      const fn = ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: from})
      await errors.expectRevert(fn)
    })

    it('can not register and activate with insufficent funds', async () => {
      // remove funds
      await ctx.contracts.token.transfer(ctx.actors.alice, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee + actFee, { from: ctx.actors.mfg })

      const fn = ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
  })

  describe('bulk registrations', () => {
    let poolStartingBalance
    let mfgStartingBalance

    const total = 10
    const mfgId = 'FIL'
    const deviceIdPrefix = 'FILDEVICE'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'

    beforeEach(async () => {
      // fund mfg with tokens for all devices
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee * total, {from: ctx.actors.owner})

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // approve token transfers for all devices
      await ctx.contracts.token.approve(ctx.contracts.devices.address, regFee * total, {from: ctx.actors.mfg})

      // record initial balances
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      poolStartingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
    })

    it('mfg can bulk register devices', async () => {
      const deviceIdHashes = []
      const deviceTypes = []
      const devicePublicKeys = []
      for (let i = 0; i < total; i++) {
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        deviceTypes.push(deviceType)
        devicePublicKeys.push(devicePublicKey)
      }

      const success = await ctx.contracts.devices.registerDevices.call(deviceIdHashes, deviceTypes, devicePublicKeys, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.devices.registerDevices(deviceIdHashes, deviceTypes, devicePublicKeys, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(total)
      for (let i = 0; i < total; i++) {
        const deviceIdHash = deviceIdHashes[i]
        const deviceType = deviceTypes[i]
        const devicePublicKey = devicePublicKeys[i]

        // confirm emitted registration logs for all devices
        const log = tx.logs[i]
        expect(log.event).to.be.equal('DeviceRegistered')
        expect(log.args._sender).to.be.equal(ctx.actors.mfg)
        expect(log.args._fee.toString(10)).to.be.equal(regFee.toString(10))
        expect(log.args._deviceHashKey).to.be.equal(deviceIdHashes[i])
        expect(web3.toAscii(log.args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)
        expect(web3.toAscii(log.args._deviceType).replace(/\u0000/g, '')).to.be.equal(deviceType)

        // confirm storage of data for all devices
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
      }

      // confirm emitted token transfer logs
      expect(tx.receipt.logs.length).to.be.equal(total + 1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.devices.address)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee * total).toString(10))

      // reconcile balances
      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal((regFee * total).toString(10))

      const poolEndingBalance = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((poolEndingBalance - poolStartingBalance).toString(10)).to.be.equal((regFee * total).toString(10))
    })

    it('can bulk operations with some failures', async () => {
      const deviceIdHashes = []
      const deviceTypes = []
      const devicePublicKeys = []
      for (let i = 0; i < total; i++) {
        if (i === 0) {
          // set a zero hash
          deviceIdHashes.push('')
        } else {
          deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        }
        deviceTypes.push(deviceType)
        devicePublicKeys.push(devicePublicKey)
      }

      const fn = ctx.contracts.devices.registerDevices(deviceIdHashes, deviceTypes, devicePublicKeys, {from: ctx.actors.mfg})
      await errors.expectRevert(fn)
    })
  })

  describe('deposit tokens', () => {
    const mfgId = 'TESTDEP'
    const amount = 1 * multiplier
    let beforeContractBal, beforePoolBal, beforeBobBal

    beforeEach(async () => {
      // fund bob with ATMI
      await ctx.contracts.token.transfer(ctx.actors.bob, amount, {from: ctx.actors.owner})

      // bob grants erc token transfer for deposit
      await ctx.contracts.token.approve(ctx.contracts.devices.address, amount, { from: ctx.actors.bob })

      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // capture initial balances
      beforeContractBal = await ctx.contracts.token.balanceOf(ctx.contracts.devices.address)
      beforeBobBal = await ctx.contracts.token.balanceOf(ctx.actors.bob)
      beforePoolBal = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
    })

    it('must have manufacture prefix', async () => {
      const badMfgId = ''
      const tx = ctx.contracts.devices.depositTokens(badMfgId, amount, {from: ctx.actors.bob})
      await errors.expectRevert(tx)
    })

    it('deposit must be greater than 0', async () => {
      const badAmount = 0
      const tx = ctx.contracts.devices.depositTokens(mfgId, badAmount, {from: ctx.actors.bob})
      await errors.expectRevert(tx)
    })

    it('can deposit tokens', async () => {
      const success = await ctx.contracts.devices.depositTokens.call(mfgId, amount, { from: ctx.actors.bob })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.devices.depositTokens(mfgId, amount, { from: ctx.actors.bob })

      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('TokensDeposited')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.bob)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)
      expect(tx.logs[0].args._manufacturer).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(amount.toString(10))

      // check token transfer for contract
      const afterContractBal = await ctx.contracts.token.balanceOf(ctx.contracts.devices.address)
      expect((afterContractBal - beforeContractBal).toString(10)).to.be.equal(amount.toString(10))

      // check token transfer for bob
      const afterBobBal = await ctx.contracts.token.balanceOf(ctx.actors.bob)
      expect((beforeBobBal - afterBobBal).toString(10)).to.be.equal(amount.toString(10))

      // check storage contract data
      const afterPoolBal = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((afterPoolBal - beforePoolBal).toString(10)).to.be.equal(amount.toString(10))
    })
  })

  describe('withdraw tokens', () => {
    const mfgId = 'TESTWITH'
    const deviceId = 'FILDEVICE1'
    const deviceType = 'SMART-WATCH'
    const devicePublicKey = '0x9c274091da1ce47bd321f272d66b6e5514fb82346d7992e2d1a3eefdeffed791'

    beforeEach(async () => {
      // onboard manufacturer
      await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      await ctx.contracts.reputation.setDefaultReputationForManufacturer(mfgId, defaultRep, {from: ctx.actors.owner})

      // fund mfg so they can register and activate a device
      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})

      // register and activate a device
      await ctx.contracts.token.contract.approve(ctx.contracts.devices.address, (regFee + actFee), { from: ctx.actors.mfg })
      await ctx.contracts.devices.registerAndActivateDevice(deviceId, deviceType, devicePublicKey, {from: ctx.actors.mfg})

      // onboard irn node
      await ctx.contracts.members.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})

      // perform a reputation write to get a reward
      const poolBalanceBefore = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      await ctx.contracts.reputation.updateReputationScore(deviceId, '9999-1-1', {from: ctx.actors.irnNode})

      // confirm pool balance is distributed correctly
      const poolBalanceAfter = await ctx.contracts.devices.poolBalance(ctx.actors.mfg)
      expect((poolBalanceBefore - poolBalanceAfter).toString(10)).to.be.equal(repReward.toString(10))
    })

    it('can withdraw tokens', async () => {
      const testWithdraws = [
        { account: ctx.actors.mfg, expectedTokens: mfgReward },
        { account: ctx.actors.irnNode, expectedTokens: irnReward }
      ]

      for (let i = 0; i < testWithdraws.length; i++) {
        const from = testWithdraws[i].account
        const expectTokens = testWithdraws[i].expectedTokens
        const tokenBefore = await ctx.contracts.token.balanceOf(from)
        const tokenContractBefore = await ctx.contracts.token.balanceOf(ctx.contracts.devices.address)

        const successWithdraw = await ctx.contracts.devices.withdrawTokens.call({ from: from })
        expect(successWithdraw).to.be.equal(true)

        const txWithdraw = await ctx.contracts.devices.withdrawTokens({ from: from })
        expect(txWithdraw.logs.length).to.be.equal(1)
        expect(txWithdraw.logs[0].event).to.be.equal('TokensWithdrawn')
        expect(txWithdraw.logs[0].args._sender).to.be.equal(from)
        expect(txWithdraw.logs[0].args._amount.toString(10)).to.be.equal(expectTokens.toString(10))

        const tokenAfter = await ctx.contracts.token.balanceOf(from)
        expect((tokenAfter - tokenBefore).toString(10)).to.be.equal(expectTokens.toString(10))

        const tokenContractAfter = await ctx.contracts.token.balanceOf(ctx.contracts.devices.address)
        expect((tokenContractBefore - tokenContractAfter).toString(10)).to.be.equal(expectTokens.toString(10))
      }

      // attempt double dips
      const doubleDip1 = ctx.contracts.devices.withdrawTokens({from: ctx.actors.irnNode})
      await errors.expectRevert(doubleDip1)
        
      const doubleDip2 = ctx.contracts.devices.withdrawTokens({from: ctx.actors.mfg})
      await errors.expectRevert(doubleDip2)
    })
  })
})