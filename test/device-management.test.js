import { expect } from 'chai'
const init = require('./helpers/init')
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

  beforeEach(async () => {
    ctx.contracts.mockSolHash = await MockSolHash.new({from: ctx.actors.owner})
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)

    await ctx.contracts.token.transfer(ctx.actors.mfg, regFee + actFee, {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.mfg, false, true, false, 'APPLE', {from: ctx.actors.owner})
    await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
    await ctx.contracts.atonomi.mapManufacturerToIRNNode(ctx.actors.irnNode, 'APPLE', {from: ctx.actors.owner})
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
    it('mfg can register', async () => {
      const irnNodeBefore = await ctx.contracts.atonomi.network(ctx.actors.irnNode)
      const startingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)

      const deviceId = 'apple-iphone1'
      const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
      const hwPubKey = 'somepubkey'
      const mfgId = 'APPLE'

      /* ERC 827
      const callbackData = ctx.contracts.atonomi.contract.registerDevice.getData(deviceIdHash, hwPubKey)
      const abiMethod = abiHelper.findMethod(ctx.contracts.token.abi, 'transfer', 'address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.atonomi.contract.address, regFee, callbackData])
      const success = await ctx.contracts.token.sendTransaction.call({from: ctx.actors.mfg, data: transferData})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.token.sendTransaction({from: ctx.actors.mfg, data: transferData})
      */

      // ERC 20
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee, { from: ctx.actors.mfg })
      const success = await ctx.contracts.atonomi.registerDevice.call(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)
      const tx = await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceRegistered')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
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
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal(regFee.toString(10))

      const mfgBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((startingBalance - mfgBalance).toString(10)).to.be.equal(regFee.toString(10))

      const atmiBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect(atmiBalance.toString(10)).to.be.equal(regFee.toString(10))

      const irnNodeAfter = await ctx.contracts.atonomi.network(ctx.actors.irnNode)
      expect((irnNodeAfter[4] - irnNodeBefore[4]).toString(10)).to.be.equal(regFee.toString(10))
    })

    it('external accounts can not register', async () => {
    })

    it('can not register device that is already registered', async () => {
    })

    it('mfg can only register devices they make', async () => {
    })

    it('can not register with insufficent funds', async () => {
    })
  })

  describe('activate device', () => {
    it('device owner can activate', async () => {
      const irnNodeBefore = await ctx.contracts.atonomi.network(ctx.actors.irnNode)

      const deviceId = 'apple-iphone1'
      const deviceIdHash = web3Utils.soliditySha3({t: 'bytes32', v: web3.fromAscii(deviceId)})
      const hwPubKey = 'somepubkey'
      const mfgId = 'APPLE'
      await ctx.contracts.token.contract.approve(ctx.contracts.atonomi.address, regFee + actFee, { from: ctx.actors.mfg })
      await ctx.contracts.atonomi.registerDevice(deviceIdHash, hwPubKey, {from: ctx.actors.mfg})
      const allowance = await ctx.contracts.token.allowance.call(ctx.actors.mfg, ctx.contracts.atonomi.address)

      const startingBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      const success = await ctx.contracts.atonomi.activateDevice.call(deviceId, {from: ctx.actors.mfg})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.activateDevice(deviceId, {from: ctx.actors.mfg})
      
      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('DeviceActivated')
      expect(log.args._sender).to.be.equal(ctx.actors.mfg)
      expect(web3.toAscii(log.args.deviceId).replace(/\u0000/g, '')).to.be.equal(deviceId)

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
      expect(tokenLog.from).to.be.equal(ctx.actors.mfg)
      expect(tokenLog.to).to.be.equal(ctx.contracts.atonomi.address)
      expect(tokenLog.value.toString(10)).to.be.equal(actFee.toString(10))

      const mfgBalance = await ctx.contracts.token.balanceOf(ctx.actors.mfg)
      expect((startingBalance - mfgBalance).toString(10)).to.be.equal(actFee.toString(10))

      const atmiBalance = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      expect(atmiBalance.toString(10)).to.be.equal((regFee + actFee).toString(10))

      const irnNodeAfter = await ctx.contracts.atonomi.network(ctx.actors.irnNode)
      expect((irnNodeAfter[4] - irnNodeBefore[4]).toString(10)).to.be.equal((regFee + actFee).toString(10))
    })

    it('persons without the device can not activate', async () => {
    })

    it('can not activate without payment', async () => {
    })

    it('can not activate device that is not registered', async () => {
    })

    it('can not activate device that is already activated', async () => {
    })
  })

  describe('register and activate device', () => {
    it('mfg can register and activate device', async () => {
    })

    it('external accounts can not register and activate device', async () => {
    })

    it('can not register and activate device that is already registered', async () => {
    })

    it('can not register and activate device that is already activated', async () => {
    })
  })

  describe('reputation', () => {
    it('IRN node can set', async () => {
    })

    it('external accounts can not set', async () => {
    })

    it('can not set with insufficent funds', async () => {
    })
  })

  describe('bulk registration', () => {
    it('can set bulk registration contract', async () => {
    })

    it('can not set 0x0', async () => {
    })

    it('mfg can bulk register devices', async () => {
    })

    it('can bulk register with some failures', async () => {
    })

    it('external accounts can not bulk register devices', async () => {
    })
  })
})
