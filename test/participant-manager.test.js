import { expect } from 'chai'
const Atonomi = artifacts.require('Atonomi')
const errors = require('./helpers/errors')
const ethjsABI = require('ethjs-abi')
const abiHelper = require('./helpers/abi')
const init = require('./helpers/init')

contract('Participant Management', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
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
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)
  })

  describe('initialized', () => {
    it('has owner', async () => {
      const owner = await ctx.contracts.atonomi.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)
    })

    it('has token', async () => {
      const token = await ctx.contracts.atonomi.token.call()
      expect(token).to.be.equal(ctx.contracts.token.address)
    })

    it('has registration fee', async () => {
      const fee = await ctx.contracts.atonomi.registrationFee.call()
      expect(fee.toString(10)).to.be.equal(regFee.toString(10))
    })

    it('has activation fee', async () => {
      const fee = await ctx.contracts.atonomi.activationFee.call()
      expect(fee.toString(10)).to.be.equal(actFee.toString(10))
    })

    it('has reputation reward', async () => {
      const fee = await ctx.contracts.atonomi.reputationReward.call()
      expect(fee.toString(10)).to.be.equal(repReward.toString(10))
    })

    it('cannot deploy with 0x0 token', async () => {
      const fn = init.getAtonomiContract(ctx.actors.owner, '0x0')
      await errors.expectRevert(fn)
    })

    it('cannot deploy with 0 token fees', async () => {
      const fees = [
        {reg: 0, act: actFee, reward: repReward},
        {reg: regFee, act: 0, reward: repReward},
        {reg: regFee, act: actFee, reward: 0}
      ]

      fees.forEach(async (testCase) => {
        const fn = Atonomi.new(ctx.contracts.token.address, testCase.reg, testCase.act, testCase.repReward, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })
    })
  })

  describe('add IRN admin', () => {
    it('owner can add', async () => {
    })

    it('irn admin can add', async () => {
    })

    it('external accounts can not add', async () => {
    })
  })

  describe('remove IRN admin', () => {
    it('owner can remove', async () => {
    })

    it('irn admin can remove', async () => {
    })

    it('external accounts can not remove', async () => {
    })
  })

  describe('add IRN node', () => {
    it('owner can add', async () => {
    })

    it('irn admin can add', async () => {
    })

    it('external accounts can not add', async () => {
    })
  })

  describe('remove IRN node', () => {
    it('owner can remove', async () => {
    })

    it('irn admin can remove', async () => {
    })

    it('external accounts can not remove', async () => {
    })
  })

  describe('add MFG', () => {
    it('owner can add', async () => {
    })

    it('IRN admin can add', async () => {
    })

    it('external accounts can not add', async () => {
    })
  })

  describe('remove MFG', () => {
    it('owner can remove', async () => {
    })

    it('IRN admin can remove', async () => {
    })

    it('IRN admin can change address', async() => {
      // this test might not be needed if UI can simply do a remove and add
    })

    it('external accounts can not remove', async () => {
    })
  })

  describe('fee management', () => {
    it('owner can set registration fee', async () => {})
    it('IRN admin can registration set fee', async () => {})
    it('owner can set activation fee', async () => {})
    it('IRN admin can activation set fee', async () => {})
    it('owner can set reputation reward fee', async () => {})
    it('IRN admin can reputation reward set fee', async () => {})
  })

  describe('token management', () => {
    it('IRN Node can withdraw tokens from their own balance', async () => {
    })

    it('external accounts can not withdraw from token pool', async () => {
    })
  })
})
