import { expect } from 'chai'
const Atonomi = artifacts.require('Atonomi')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Network Management', accounts => {
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
  const contributorReward = repReward * 0.8
  const irnReward = repReward - contributorReward

  const testAdd = async (newMember, isIrnAdmin, isMFG, isIrnNode, memberId, from) => {
    const success = await ctx.contracts.atonomi.addNetworkMember.call(
      newMember,
      isIrnAdmin,
      isMFG,
      isIrnNode,
      memberId,
      { from: from })
    expect(success).to.be.equal(true)

    const tx = await ctx.contracts.atonomi.addNetworkMember(
      newMember,
      isIrnAdmin,
      isMFG,
      isIrnNode,
      memberId,
      { from: from })

    expect(tx.logs.length).to.be.equal(1)
    const log = tx.logs[0]
    expect(log.event).to.be.equal('NetworkMemberAdded')
    expect(log.args._sender).to.be.equal(from)
    expect(log.args._member).to.be.equal(newMember)
    expect(memberId).to.be.equal(web3.toAscii(log.args._memberId).replace(/\u0000/g, ''))

    const m = await ctx.contracts.atonomi.network(newMember)
    expect(m[0]).to.be.equal(isIrnAdmin)
    expect(m[1]).to.be.equal(isMFG)
    expect(m[2]).to.be.equal(isIrnNode)
    expect(memberId).to.be.equal(web3.toAscii(m[3]).replace(/\u0000/g, ''))
  }

  const testRemove = async (member, memberId, from) => {
    const success = await ctx.contracts.atonomi.removeNetworkMember.call(member, {from: from})
    expect(success).to.be.equal(true)

    const tx = await ctx.contracts.atonomi.removeNetworkMember(member, {from: from})
    expect(tx.logs.length).to.be.equal(1)
    expect(tx.logs[0].event).to.be.equal('NetworkMemberRemoved')
    expect(tx.logs[0].args._sender).to.be.equal(from)
    expect(tx.logs[0].args._member).to.be.equal(member)
    expect(web3.toAscii(tx.logs[0].args._memberId).replace(/\u0000/g, '')).to.be.equal(memberId)

    const m = await ctx.contracts.atonomi.network(member)
    expect(m[0]).to.be.equal(false)
    expect(m[1]).to.be.equal(false)
    expect(m[2]).to.be.equal(false)
    expect(web3.toAscii(m[3]).replace(/\u0000/g, '')).to.be.equal('')
  }

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

    it('has correct reward split with contributor and irn node', async () => {
      const rewards = await ctx.contracts.atonomi.getReputationRewards()
      expect(rewards[0].toString(10)).to.be.equal(contributorReward.toString(10))
      expect(rewards[1].toString(10)).to.be.equal(irnReward.toString(10))
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

      for (let i = 0; i < fees.length; i++) {
        const testCase = fees[i]
        const fn = Atonomi.new(ctx.contracts.token.address, testCase.reg, testCase.act, testCase.repReward, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      }
    })
  })

  describe('IRN Admins', () => {
    describe('add IRN admin', () => {
      it('owner can add', async () => {
        const isIrnAdmin = true
        const isMFG = false
        const isIrnNode = false
        const memberId = ''
        await testAdd(ctx.actors.admin,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.owner)
      })

      it('irn admin can add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = true
        const isMFG = false
        const isIrnNode = false
        const memberId = ''
        await testAdd(ctx.actors.alice,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, true, false, false, '', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove IRN admin', () => {
      beforeEach(async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})
      })

      it('owner can remove', async () => {
        const member = ctx.actors.admin
        const from = ctx.actors.owner
        await testRemove(member, '', from)
      })

      it('irn admin can remove', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, true, false, false, '', {from: ctx.actors.owner})

        const member = ctx.actors.alice
        const from = ctx.actors.admin
        await testRemove(member, '', from)
      })

      it('external accounts can not remove', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.removeNetworkMember(ctx.actors.admin, {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })
  })

  describe('IRN Node', () => {
    describe('add IRN node', () => {
      it('owner can add', async () => {
        const isIrnAdmin = false
        const isMFG = false
        const isIrnNode = true
        const memberId = ''
        await testAdd(ctx.actors.admin,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.owner)
      })

      it('irn admin can add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = false
        const isMFG = false
        const isIrnNode = true
        const memberId = ''
        await testAdd(ctx.actors.alice,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, false, false, true, '', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove IRN node', () => {
      beforeEach(async () => {
        const owner = await ctx.contracts.atonomi.owner.call()

        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        expect(ctx.actors.irnNode).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
      })

      it('owner can remove', async () => {
        const member = ctx.actors.irnNode
        const from = ctx.actors.owner
        await testRemove(member, '', from)
      })

      it('irn admin can remove', async () => {
        const member = ctx.actors.irnNode
        const from = ctx.actors.admin
        await testRemove(member, '', from)
      })

      it('external accounts can not remove', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.removeNetworkMember(ctx.actors.irnNode, {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })
  })

  describe('Manufacturer', () => {
    describe('add MFG', () => {
      it('owner can add', async () => {
        const isIrnAdmin = false
        const isMFG = true
        const isIrnNode = false
        const memberId = 'APPLE'
        await testAdd(ctx.actors.mfg,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.owner)
      })

      it('IRN admin can add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = false
        const isMFG = true
        const isIrnNode = false
        const memberId = 'APPLE'
        await testAdd(ctx.actors.mfg,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.addNetworkMember(ctx.actors.alice, false, true, false, 'APPLE', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove MFG', () => {
      const mfgId = 'APPLE'

      beforeEach(async () => {
        const owner = await ctx.contracts.atonomi.owner.call()

        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        expect(ctx.actors.mfg).not.to.be.equal(owner)
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})
      })

      it('owner can remove', async () => {
        const member = ctx.actors.mfg
        const from = ctx.actors.owner
        await testRemove(member, mfgId, from)
      })

      it('IRN admin can remove', async () => {
        const member = ctx.actors.mfg
        const from = ctx.actors.admin
        await testRemove(member, mfgId, from)
      })

      it('external accounts can not remove', async () => {
        const owner = await ctx.contracts.atonomi.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
        expect(m[0]).not.to.equal(true)

        const fn = ctx.contracts.atonomi.removeNetworkMember(ctx.actors.mfg, {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })
  })

  describe('fee management', () => {
    const newRegFee = regFee * 2
    const newActFee = actFee * 2
    const newRepReward = repReward * 2

    describe('registrations fee', () => {
      it('owner can set fee', async () => {
        const success = await ctx.contracts.atonomi.setRegistrationFee.call(newRegFee, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setRegistrationFee(newRegFee, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('RegistrationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRegFee.toString(10))

        const fee = await ctx.contracts.atonomi.registrationFee()
        expect(fee.toString(10)).to.be.equal(newRegFee.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.atonomi.setRegistrationFee(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.atonomi.setRegistrationFee(regFee, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.atonomi.setRegistrationFee(newRegFee, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set fee', async () => {
        const fn = ctx.contracts.atonomi.setRegistrationFee(newRegFee, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('activation fee', () => {
      it('owner can set fee', async () => {
        const success = await ctx.contracts.atonomi.setActivationFee.call(newActFee, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setActivationFee(newActFee, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ActivationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newActFee.toString(10))

        const fee = await ctx.contracts.atonomi.activationFee()
        expect(fee.toString(10)).to.be.equal(newActFee.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.atonomi.setActivationFee(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.atonomi.setActivationFee(actFee, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.atonomi.setActivationFee(newActFee, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set fee', async () => {
        const fn = ctx.contracts.atonomi.setActivationFee(newActFee, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('reputation reward', () => {
      it('owner can set reward', async () => {
        const success = await ctx.contracts.atonomi.setReputationReward.call(newRepReward, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setReputationReward(newRepReward, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ReputationRewardUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRepReward.toString(10))

        const fee = await ctx.contracts.atonomi.reputationReward()
        expect(fee.toString(10)).to.be.equal(newRepReward.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.atonomi.setReputationReward(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.atonomi.setReputationReward(repReward, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set reward', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.atonomi.setReputationReward(newRepReward, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set reward', async () => {
        const fn = ctx.contracts.atonomi.setReputationReward(newRepReward, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('reward split for reputation', () => {
      const newShare = 50
      const newContributionReward = repReward * 0.5
      const newIrnReward = repReward - newContributionReward

      it('owner can set reward', async () => {
        const success = await ctx.contracts.atonomi.setReputationTokenShare.call(newShare, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setReputationTokenShare(newShare, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ReputationTokenShareUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._percentage.toString(10)).to.be.equal(newShare.toString(10))

        const rewards = await ctx.contracts.atonomi.getReputationRewards()
        expect(rewards[0].toString(10)).to.be.equal(newContributionReward.toString(10))
        expect(rewards[1].toString(10)).to.be.equal(newIrnReward.toString(10))
      })

      it('can not set share to 0%', async () => {
        const fn = ctx.contracts.atonomi.setReputationTokenShare(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set share over 100%', async () => {
        const fn = ctx.contracts.atonomi.setReputationTokenShare(101, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set share to same value', async () => {
        const fn = ctx.contracts.atonomi.setReputationTokenShare(80, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set split', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.atonomi.setReputationTokenShare(newShare, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set split', async () => {
        const fn = ctx.contracts.atonomi.setReputationTokenShare(newShare, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })
  })

  describe('token management', () => {
    it('anyone can deposit tokens', async () => {
      await ctx.contracts.token.transfer(ctx.actors.alice, regFee, {from: ctx.actors.owner})

      const beforePoolBal = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      const beforeAliceBal = await ctx.contracts.token.balanceOf(ctx.actors.alice)

      const tx = await ctx.contracts.token.transfer(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.alice})
      expect(tx.logs.length).to.be.equal(1)

      const afterPoolBal = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      const afterAliceBal = await ctx.contracts.token.balanceOf(ctx.actors.alice)
      expect((afterPoolBal - beforePoolBal).toString(10)).to.be.equal(regFee.toString(10))
      expect((beforeAliceBal - afterAliceBal).toString(10)).to.be.equal(regFee.toString(10))
    })

    it('owner can distribute tokens from pool', async () => {
      await ctx.contracts.token.transfer(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.owner})

      const aliceBefore = await ctx.contracts.atonomi.balances(ctx.actors.alice)

      const success = await ctx.contracts.atonomi.rewardContributor.call(ctx.actors.alice, regFee, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.rewardContributor(ctx.actors.alice, regFee, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ContributorRewarded')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._contributor).to.be.equal(ctx.actors.alice)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(regFee.toString(10))

      const aliceAfter = await ctx.contracts.atonomi.balances(ctx.actors.alice)
      expect((aliceAfter - aliceBefore).toString(10)).to.be.equal(regFee.toString(10))
    })
  })
})
