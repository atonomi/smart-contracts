import { expect } from 'chai'
const init = require('./helpers/init')
const errors = require('./helpers/errors')
const web3Utils = require('web3-utils')
const ethjsABI = require('ethjs-abi')
const abiHelper = require('./helpers/abi')
const MockSolHash = artifacts.require('MockSolHash')

contract('Device Management', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      mockSolHash: null,
      token: null,
      atonomi: null
    }
  }

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier

  const deviceId = 'apple-iphone1'
  const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
  const hwPubKey = 'somepubkey'
  const mfgId = 'APPLE'

  beforeEach(async () => {
    ctx.contracts.mockSolHash = await MockSolHash.new({from: ctx.actors.owner})
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)

    await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
    await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
    await ctx.contracts.atonomi.mapManufacturerToIRNNode(ctx.actors.irnNode, mfgId, {from: ctx.actors.owner})
  })

  describe('hashing', () => {
    it('can build hash in JavaScript and verify in Solidity', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test')
      expect(hash).to.be.equal(solHash)
    })

    it('can create a bad match in Solidity', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test2')
      expect(hash).not.to.be.equal(solHash)
    })

    it('can create a bad match in JavaScript', async () => {
      const hash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii('test2')})
      const solHash = await ctx.contracts.mockSolHash.solHash.call('test')
      expect(hash).not.to.be.equal(solHash)
    })
  })

  describe('register device', () => {
    let irnStartingBalance
    let mfgStartingBalance

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
    })

    it('mfg can register (ERC20)', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      const success = await ctx.contracts.atonomi.registerDevice.call(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(false)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.value.toString(10)).to.be.equal(regFee.toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal(regFee.toString(10))
    })

    it('mfg can register (ERC827)', async () => {
      const registerDeviceData = ctx.contracts.atonomi.contract.registerDevice827.getData(ctx.actors.mfg, deviceIdHash, hwPubKey)
      const abiMethod = abiHelper.findMethod(ctx.contracts.token.abi, 'approve', 'address,uint256,bytes')
      const tokenData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.atonomi.contract.address, regFee, registerDeviceData])
      const tx = await ctx.contracts.token.sendTransaction({from: ctx.actors.mfg, data: tokenData})

      expect(tx.logs.length).to.be.equal(2)
      expect(tx.logs[0].event).to.be.equal('Approval')
      expect(tx.logs[0].args.owner).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[0].args.spender).to.be.equal(ctx.contracts.atonomi.address)
      expect(tx.logs[0].args.value.toString(10)).to.be.equal(regFee.toString(10))

      expect(tx.logs[1].event).to.be.equal('Transfer')
      expect(tx.logs[1].args.from).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[1].args.to).to.be.equal(ctx.actors.irnNode)
      expect(tx.logs[1].args.value.toString(10)).to.be.equal(regFee.toString(10))

      expect(tx.receipt.logs.length).to.be.equal(3)
      const decoder = ethjsABI.logDecoder(ctx.contracts.atonomi.abi)
      const regEvent = decoder(tx.receipt.logs)
      expect(regEvent[0]._eventName).to.be.equal('DeviceRegistered')
      expect(regEvent[0]._sender).to.be.equal(ctx.actors.mfg)
      expect(regEvent[0]._beneficiary).to.be.equal(ctx.actors.irnNode)
      expect(regEvent[0]._deviceHashKey).to.be.equal(deviceIdHash)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(false)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal(regFee.toString(10))
    })

    it('external accounts can not register', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, {from: from})
        const fn = ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register device that is already registered', async () => {
      const from = ctx.actors.mfg
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, 2 * regFee, {from: from})
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
      const fn = ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: from})
      await errors.expectRevert(fn)
    })
  })

  describe('activate device', () => {
    let irnStartingBalance
    let mfgStartingBalance
    let devOwnerStartingBalance

    beforeEach(async () => {
      devOwnerStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      irnStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
    })

    it('device owner can activate', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const success = await ctx.contracts.atonomi.activateDevice.call(deviceId, {from: ctx.actors.deviceOwner})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceActivated')
      expect(log.args._sender).to.be.equal(ctx.actors.deviceOwner)
      expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(log.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.deviceOwner)
      expect(tokenLog.to).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.value.toString(10)).to.be.equal(actFee.toString(10))

      const devOwnerEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.deviceOwner)
      expect((devOwnerStartingBalance - devOwnerEndingBalance).toString(10)).to.be.equal(actFee.toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal(regFee.toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('persons without the device can not activate', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      const wrongDeviceId = 'samsung-microwave1'
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const fn = ctx.contracts.atonomi.activateDevice(wrongDeviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate device that is not registered', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      const fn = ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })

    it('can not activate device that is already activated', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, actFee, { from: ctx.actors.deviceOwner })
      await ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})

      await ctx.contracts.token.transfer(ctx.actors.deviceOwner, actFee, {from: ctx.actors.owner})
      const fn = ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.deviceOwner})
      await errors.expectRevert(fn)
    })
  })

  describe('register and activate device', () => {
    let irnStartingBalance
    let mfgStartingBalance

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
    })

    it('mfg can register and activate device', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee), { from: ctx.actors.mfg })
      const success = await ctx.contracts.atonomi.registerAndActivateDevice.call(deviceId, hwPubKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(2)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
      expect(log.args._deviceHashKey).to.be.equal(deviceIdHash)

      const log1 = tx.logs[1]
      expect(log1.event).to.be.equal('DeviceActivated')
      expect(log1.args._sender).to.be.equal(ctx.actors.mfg)
      expect(log1.args._beneficiary).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(log1.args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(3)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee + actFee).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgStartingBalance - mfgEndingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('external accounts can not register and activate device', async () => {
      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, (regFee + actFee), {from: from})
        const fn = ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
        await errors.expectRevert(fn)
      }
    })

    it('can not register and activate device that is already registered', async () => {
      const from = ctx.actors.mfg
      await ctx.contracts.token.transfer(ctx.actors.mfg, 2 * (regFee + actFee), {from: ctx.actors.owner})
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, 2 * (regFee + actFee), {from: from})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
      const fn = ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: from})
      await errors.expectRevert(fn)
    })
  })

  describe('reputation scores', () => {
    let irnStartingBalance
    let repAuditorStartingBalance
    const score = 'somescore'

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      repAuditorStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.repAuditor)
    })

    it('IRN node can set', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, repReward, {from: ctx.actors.irnNode})
      const success = await ctx.contracts.atonomi.updateReputationScore.call(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})

      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ReputationScoreUpdated')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(tx.logs[0].args._deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)
      expect(web3.toAscii(tx.logs[0].args._newScore).replace(/\u0000/g, '')).to.be.equal(score)
      expect(tx.logs[0].args._beneficiary).to.be.equal(ctx.actors.repAuditor)

      const device = await ctx.contracts.atonomi.devices(deviceIdHash)
      expect(hwPubKey).to.be.equal(web3.toAscii(device[0]).replace(/\u0000/g, ''))
      expect(mfgId).to.be.equal(web3.toAscii(device[1]).replace(/\u0000/g, ''))
      expect(device[2]).to.be.equal(true)
      expect(device[3]).to.be.equal(true)
      expect(score).to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.to).to.be.equal(ctx.actors.repAuditor)
      expect(tokenLog.value.toString(10)).to.be.equal(repReward.toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal(repReward.toString(10))

      const repAuditorEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.repAuditor)
      expect((repAuditorEndingBalance - repAuditorStartingBalance).toString(10)).to.be.equal(repReward.toString(10))
    })

    it('can not set score for device that is not activated', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, repReward, {from: ctx.actors.irnNode})
      const fn = ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: ctx.actors.irnNode})
      await errors.expectRevert(fn)
    })

    it('external accounts can not set', async () => {
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, {from: ctx.actors.mfg})
      await ctx.contracts.atonomi.registerAndActivateDevice(deviceId, hwPubKey, {from: ctx.actors.mfg})

      const bads = [ctx.actors.owner, ctx.actors.admin, ctx.actors.deviceOwner, ctx.actors.mfg, ctx.actors.alice]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, repReward, {from: from})
        const fn = ctx.contracts.atonomi.updateReputationScore(deviceId, score, ctx.actors.repAuditor, {from: from})
        await errors.expectRevert(fn)
      }
    })
  })

  describe('bulk registration', () => {
    let irnStartingBalance
    let mfgStartingBalance

    const total = 10
    const deviceIdPrefix = 'apple-ipad'
    const hwPubKeyPrefix = 'hwpubkey'

    beforeEach(async () => {
      irnStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      mfgStartingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)

      await ctx.contracts.token.transfer(ctx.actors.mfg, regFee * total, {from: ctx.actors.owner})
    })

    it('mfg can bulk register devices', async () => {
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        hwPublicKeys.push(hwPubKeyPrefix + i)
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee * total, {from: ctx.actors.mfg})
      const success = await ctx.contracts.atonomi.registerDevices.call(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.registerDevices(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(tx.logs.length).to.be.equal(total)

      for (let i = 0; i < total; i++) {
        const log = tx.logs[i]
        expect(log.event).to.be.equal('DeviceRegistered')
        expect(log.args._sender).to.be.equal(ctx.actors.mfg)
        expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
        expect(log.args._deviceHashKey).to.be.equal(deviceIdHashes[i])

        const device = await ctx.contracts.atonomi.devices(deviceIdHashes[i])
        expect(web3.toAscii(device[0]).replace(/\u0000/g, '')).to.be.equal(hwPublicKeys[i])
        expect(web3.toAscii(device[1]).replace(/\u0000/g, '')).to.be.equal(mfgId)
        expect(device[2]).to.be.equal(true)
        expect(device[3]).to.be.equal(false)
        expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))
      }

      expect(tx.receipt.logs.length).to.be.equal(total + 1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee * total).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgEndingBalance - mfgStartingBalance).toString(10)).to.be.equal('0')

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal((regFee * total).toString(10))
    })

    it('can bulk register with some failures', async () => {
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        if (i === 0) {
          // set a zero hash
          deviceIdHashes.push('')
          hwPublicKeys.push(hwPubKeyPrefix + i)
        } else if (i === 1) {
          // set a zero pub key
          deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
          hwPublicKeys.push('')
        } else {
          deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
          hwPublicKeys.push(hwPubKeyPrefix + i)
        }
      }
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee * total, {from: ctx.actors.mfg})
      const success = await ctx.contracts.atonomi.registerDevices.call(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.registerDevices(deviceIdHashes, hwPublicKeys, {from: ctx.actors.mfg})
      expect(tx.logs.length).to.be.equal(total)

      for (let i = 0; i < total; i++) {
        const log = tx.logs[i]

        if (i === 0 || i === 1) {
          expect(log.event).to.be.equal('DeviceRegistrationFailed')
          expect(log.args._sender).to.be.equal(ctx.actors.mfg)
          expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
          expect(log.args._deviceHashKey).to.be.equal(i === 0 ? '0x0000000000000000000000000000000000000000000000000000000000000000' : deviceIdHashes[i])
        } else {
          expect(log.event).to.be.equal('DeviceRegistered')
          expect(log.args._sender).to.be.equal(ctx.actors.mfg)
          expect(log.args._beneficiary).to.be.equal(ctx.actors.irnNode)
          expect(log.args._deviceHashKey).to.be.equal(deviceIdHashes[i])

          const device = await ctx.contracts.atonomi.devices(deviceIdHashes[i])
          expect(web3.toAscii(device[0]).replace(/\u0000/g, '')).to.be.equal(hwPublicKeys[i])
          expect(web3.toAscii(device[1]).replace(/\u0000/g, '')).to.be.equal(mfgId)
          expect(device[2]).to.be.equal(true)
          expect(device[3]).to.be.equal(false)
          expect('').to.be.equal(web3.toAscii(device[4]).replace(/\u0000/g, ''))
        }
      }

      expect(tx.receipt.logs.length).to.be.equal(total + 1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.token.abi)
      const tokenEvents = decoder(tx.receipt.logs)
      const tokenLog = tokenEvents[0]
      expect(tokenLog._eventName).to.be.equal('Transfer')
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.actors.irnNode)
      expect(tokenLog.value.toString(10)).to.be.equal((regFee * (total - 2)).toString(10))

      const mfgEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((mfgEndingBalance - mfgStartingBalance).toString(10)).to.be.equal((regFee * 2).toString(10))

      const irnEndingBalance = await ctx.contracts.token.balanceOf(ctx.actors.irnNode)
      expect((irnEndingBalance - irnStartingBalance).toString(10)).to.be.equal((regFee * (total - 2)).toString(10))
    })

    it('external accounts can not bulk register devices', async () => {
      const deviceIdHashes = []
      const hwPublicKeys = []
      for (let i = 0; i < total; i++) {
        deviceIdHashes.push(web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceIdPrefix + i)}))
        hwPublicKeys.push(hwPubKeyPrefix + i)
      }

      const bads = [ctx.actors.alice, ctx.actors.owner, ctx.actors.admin, ctx.actors.irnNode]
      for (let i = 0; i < bads.length; i++) {
        const from = bads[i]
        await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee * total, {from: from})
        const fn = ctx.contracts.atonomi.registerDevices(deviceIdHashes, hwPublicKeys, {from: from})
        await errors.expectRevert(fn)
      }
    })
  })
})
