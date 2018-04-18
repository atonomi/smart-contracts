import { expect } from 'chai'
const init = require('./helpers/init')
const web3Utils = require('web3-utils')
const MockSolHash = artifacts.require('MockSolHash')

contract('Atonomi Device Manager', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      mockSolHash: null
    }
  }

  beforeEach(async () => {
    ctx.contracts.mockSolHash = await MockSolHash.new({from: ctx.actors.owner})
  })

  describe('hashing', () => {
    it('can build hash in JavaScript, and verify in Solidity', async () => {
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

  describe('initialized', () => {
    it('has owner', async () => {
    })

    it('has ERC827 Token', async () => {
    })

    it('has activation fee', async () => {
    })

    it('has registration fee', async () => {
    })

    it('has reputation reward', async () => {
    })
  })

  describe('register device', () => {
    it('mfg can register', async () => {
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

  describe('pay for activation', () => {
    it('device owner can pay', async () => {
    })

    it('persons without the device can not pay', async () => {
    })

    it('can not pay with insufficent funds', async () => {
    })

    it('can not pay for a device that is already paid', async () => {
    })

    it('can not pay for a device that is not registered', async () => {
    })

    it('can not pay for a device that is already activated', async () => {
    })
  })

  describe('activate device', () => {
    it('device owner can activate', async () => {
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
    it('IRN admin can set', async () => {
    })

    it('external accounts can not set', async () => {
    })

    it('can not set with insufficent funds', async () => {
    })
  })
})
