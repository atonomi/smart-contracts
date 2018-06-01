import { expect } from 'chai'
const NetworkSettings = artifacts.require('NetworkSettings')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Network Management', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      token: null,
      atonomi: null,
      settings: null
    }
  }

  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier
  const repShare = 20
  const blockThreshold = 5760
  const contributorReward = repReward * 0.2
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

    const wallet = await ctx.contracts.atonomi.manufacturerRewards(memberId)
    const pool = await ctx.contracts.atonomi.pools(newMember)
    if (isMFG) {
      expect(wallet).to.be.equal(newMember)
      expect(pool[0].toString(10)).to.be.equal('0')
      expect(pool[1].toString(10)).to.be.equal(repReward.toString(10))
    } else {
      expect(wallet).to.be.equal('0x0000000000000000000000000000000000000000')
      expect(pool[0].toString(10)).to.be.equal('0')
      expect(pool[1].toString(10)).to.be.equal('0')
    }
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

    const wallet = await ctx.contracts.atonomi.manufacturerRewards(memberId)
    expect(wallet).to.be.equal('0x0000000000000000000000000000000000000000')

    const pool = await ctx.contracts.atonomi.pools(member)
    expect(pool[0].toString(10)).to.be.equal('0')
    expect(pool[1].toString(10)).to.be.equal('0')
  }

  beforeEach(async () => {
    ctx.contracts.token = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.atonomi = await init.getAtonomiContract(ctx.actors.owner, ctx.contracts.token.address)
    ctx.contracts.settings = await NetworkSettings.at(await ctx.contracts.atonomi.settings())
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
      const fee = await ctx.contracts.settings.registrationFee.call()
      expect(fee.toString(10)).to.be.equal(regFee.toString(10))
    })

    it('has activation fee', async () => {
      const fee = await ctx.contracts.settings.activationFee.call()
      expect(fee.toString(10)).to.be.equal(actFee.toString(10))
    })

    it('has default reputation reward', async () => {
      const fee = await ctx.contracts.settings.defaultReputationReward.call()
      expect(fee.toString(10)).to.be.equal(repReward.toString(10))
    })

    it('has correct reward split with contributor and irn node', async () => {
      const deviceId = 'somedeviceid'
      const isIrnAdmin = false
      const isMFG = true
      const isIrnNode = false
      const memberId = 'APPLE'
      await testAdd(ctx.actors.alice, isIrnAdmin, isMFG, isIrnNode, memberId, ctx.actors.owner)
      const rewards = await ctx.contracts.atonomi.getReputationRewards(ctx.actors.irnNode, ctx.actors.alice, deviceId)
      expect(rewards[0].toString(10)).to.be.equal(contributorReward.toString(10))
      expect(rewards[1].toString(10)).to.be.equal(irnReward.toString(10))
    })

    it('cannot deploy with 0x0 token', async () => {
      const fn = init.getAtonomiContract(ctx.actors.owner, '0x0')
      await errors.expectRevert(fn)
    })

    it('cannot deploy with 0 token fees', async () => {
      const fees = [
        {reg: 0, act: actFee, reward: repReward, share: repShare, block: blockThreshold},
        {reg: regFee, act: 0, reward: repReward, share: repShare, block: blockThreshold},
        {reg: regFee, act: actFee, reward: 0, share: repShare, block: blockThreshold},
        {reg: regFee, act: actFee, reward: repReward, share: 0, block: blockThreshold}
      ]

      for (let i = 0; i < fees.length; i++) {
        const testCase = fees[i]
        const fn = NetworkSettings.new(
          testCase.reg,
          testCase.act,
          testCase.reward,
          testCase.share,
          testCase.block, {from: ctx.actors.owner})
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

    describe('can update token pool', () => {
      const memberId = 'APPLE'

      beforeEach(async () => {
        const isIrnAdmin = false
        const isMFG = true
        const isIrnNode = false
        await testAdd(ctx.actors.mfg,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.owner)
      })

      it('can change to a different wallet', async () => {
        await ctx.contracts.token.approve(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.owner})
        await ctx.contracts.atonomi.depositTokens(memberId, regFee, {from: ctx.actors.owner})

        const success = await ctx.contracts.atonomi.changeManufacturerWallet.call(ctx.actors.alice, {from: ctx.actors.mfg})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.changeManufacturerWallet(ctx.actors.alice, {from: ctx.actors.mfg})

        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ManufacturerRewardWalletChanged')
        expect(tx.logs[0].args._old).to.be.equal(ctx.actors.mfg)
        expect(tx.logs[0].args._new).to.be.equal(ctx.actors.alice)
        expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(memberId)

        const wallet = await ctx.contracts.atonomi.manufacturerRewards(memberId)
        expect(wallet).to.be.equal(ctx.actors.alice)

        const oldM = await ctx.contracts.atonomi.network(ctx.actors.mfg)
        expect(oldM[0]).to.be.equal(false)
        expect(oldM[1]).to.be.equal(false)
        expect(oldM[2]).to.be.equal(false)
        expect(web3.toAscii(oldM[3]).replace(/\u0000/g, '')).to.be.equal('')

        const newM = await ctx.contracts.atonomi.network(ctx.actors.alice)
        expect(newM[0]).to.be.equal(false)
        expect(newM[1]).to.be.equal(true)
        expect(newM[2]).to.be.equal(false)
        expect(web3.toAscii(newM[3]).replace(/\u0000/g, '')).to.be.equal(memberId)

        const oldPool = await ctx.contracts.atonomi.pools(ctx.actors.mfg)
        expect(oldPool[0].toString(10)).to.be.equal('0')
        expect(oldPool[1].toString(10)).to.be.equal('0')

        const newPool = await ctx.contracts.atonomi.pools(ctx.actors.alice)
        expect(newPool[0].toString(10)).to.be.equal(regFee.toString(10))
        expect(newPool[1].toString(10)).to.be.equal(repReward.toString(10))
      })

      it('can change token reward for reputation', async () => {
        const newReward = repReward * 2
        const success = await ctx.contracts.atonomi.setTokenPoolReward.call(newReward, {from: ctx.actors.mfg})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setTokenPoolReward(newReward, {from: ctx.actors.mfg})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('TokenPoolRewardUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.mfg)
        expect(tx.logs[0].args._newReward.toString(10)).to.be.equal(newReward.toString(10))

        const pool = await ctx.contracts.atonomi.pools(ctx.actors.mfg)
        expect(pool[0].toString(10)).to.be.equal('0')
        expect(pool[1].toString(10)).to.be.equal(newReward.toString(10))
      })
    })
  })

  describe('global fee management', () => {
    const newRegFee = regFee * 2
    const newActFee = actFee * 2
    const newRepReward = repReward * 2

    describe('registrations fee', () => {
      it('owner can set fee', async () => {
        const success = await ctx.contracts.settings.setRegistrationFee.call(newRegFee, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.settings.setRegistrationFee(newRegFee, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('RegistrationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRegFee.toString(10))

        const fee = await ctx.contracts.settings.registrationFee()
        expect(fee.toString(10)).to.be.equal(newRegFee.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.settings.setRegistrationFee(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.settings.setRegistrationFee(regFee, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.settings.setRegistrationFee(newRegFee, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set fee', async () => {
        const fn = ctx.contracts.settings.setRegistrationFee(newRegFee, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('activation fee', () => {
      it('owner can set fee', async () => {
        const success = await ctx.contracts.settings.setActivationFee.call(newActFee, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.settings.setActivationFee(newActFee, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ActivationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newActFee.toString(10))

        const fee = await ctx.contracts.settings.activationFee()
        expect(fee.toString(10)).to.be.equal(newActFee.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.settings.setActivationFee(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.settings.setActivationFee(actFee, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.settings.setActivationFee(newActFee, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set fee', async () => {
        const fn = ctx.contracts.settings.setActivationFee(newActFee, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('default reputation reward', () => {
      it('owner can set default reward', async () => {
        const success = await ctx.contracts.settings.setDefaultReputationReward.call(newRepReward, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.settings.setDefaultReputationReward(newRepReward, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('DefaultReputationRewardUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRepReward.toString(10))

        const fee = await ctx.contracts.settings.defaultReputationReward()
        expect(fee.toString(10)).to.be.equal(newRepReward.toString(10))
      })

      it('can not set fee to 0', async () => {
        const fn = ctx.contracts.settings.setDefaultReputationReward(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set fee to same value', async () => {
        const fn = ctx.contracts.settings.setDefaultReputationReward(repReward, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set default reward', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.settings.setDefaultReputationReward(newRepReward, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set default reward', async () => {
        const fn = ctx.contracts.settings.setDefaultReputationReward(newRepReward, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('reward split for reputation', () => {
      const newShare = 50
      const newContributionReward = repReward * 0.5
      const newIrnReward = repReward - newContributionReward

      it('owner can set reward', async () => {
        const success = await ctx.contracts.settings.setReputationIRNNodeShare.call(newShare, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.settings.setReputationIRNNodeShare(newShare, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ReputationIRNNodeShareUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._percentage.toString(10)).to.be.equal(newShare.toString(10))

        const deviceId = 'somedeviceid'
        const isIrnAdmin = false
        const isMFG = true
        const isIrnNode = false
        const memberId = 'APPLE'
        await testAdd(ctx.actors.alice, isIrnAdmin, isMFG, isIrnNode, memberId, ctx.actors.owner)
        const rewards = await ctx.contracts.atonomi.getReputationRewards(ctx.actors.irnNode, ctx.actors.alice, deviceId)
        expect(rewards[0].toString(10)).to.be.equal(newContributionReward.toString(10))
        expect(rewards[1].toString(10)).to.be.equal(newIrnReward.toString(10))
      })

      it('can not set share to 0%', async () => {
        const fn = ctx.contracts.settings.setReputationIRNNodeShare(0, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set share over 100%', async () => {
        const fn = ctx.contracts.settings.setReputationIRNNodeShare(101, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('can not set share to same value', async () => {
        const fn = ctx.contracts.settings.setReputationIRNNodeShare(20, {from: ctx.actors.owner})
        await errors.expectRevert(fn)
      })

      it('IRN admin can not set split', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const fn = ctx.contracts.settings.setReputationIRNNodeShare(newShare, {from: ctx.actors.admin})
        await errors.expectRevert(fn)
      })

      it('external accounts cannot set split', async () => {
        const fn = ctx.contracts.settings.setReputationIRNNodeShare(newShare, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })

    describe('reward decay', () => {
      it('first write should get full reward', async () => {
        const totalReward = 10 * multiplier
        const lastWrite = 0
        const reward = await ctx.contracts.atonomi.calculateReward(totalReward, lastWrite)
        expect(reward.toString(10)).to.be.equal(totalReward.toString(10))
      })

      it('at threshold should get full reward', async () => {
        const totalReward = 10 * multiplier
        const lastWrite = blockThreshold
        const reward = await ctx.contracts.atonomi.calculateReward(totalReward, lastWrite)
        expect(reward.toString(10)).to.be.equal(totalReward.toString(10))
      })

      it('past threshold should get full reward', async () => {
        const totalReward = 10 * multiplier
        const lastWrite = blockThreshold + 500
        const reward = await ctx.contracts.atonomi.calculateReward(totalReward, lastWrite)
        expect(reward.toString(10)).to.be.equal(totalReward.toString(10))
      })

      it('immediate write should get smallest reward', async () => {
        const totalReward = 10 * multiplier
        const lastWrite = 1
        const expectedReward = '1736111111111111'
        const reward = await ctx.contracts.atonomi.calculateReward(totalReward, lastWrite)
        expect(reward.toString(10)).to.be.equal(expectedReward)
      })

      it('fast write should get smaller reward', async () => {
        const totalReward = 10 * multiplier
        const lastWrite = 150
        const expectedReward = '260416666666666666'
        const reward = await ctx.contracts.atonomi.calculateReward(totalReward, lastWrite)
        expect(reward.toString(10)).to.be.equal(expectedReward)
      })
    })

    describe('block threshold', () => {
      it('owner can set fee', async () => {
        const newBlockThreshold = 240
        const success = await ctx.contracts.settings.setRewardBlockThreshold.call(newBlockThreshold, {from: ctx.actors.owner})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.settings.setRewardBlockThreshold(newBlockThreshold, {from: ctx.actors.owner})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('RewardBlockThresholdChanged')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
        expect(tx.logs[0].args._newBlockThreshold.toString(10)).to.be.equal(newBlockThreshold.toString(10))

        const threshold = await ctx.contracts.settings.blockThreshold()
        expect(threshold.toString(10)).to.be.equal(newBlockThreshold.toString(10))
      })
    })
  })

  describe('token management', () => {
    const memberId = 'APPLE'

    it('anyone can deposit tokens', async () => {
      await ctx.contracts.token.transfer(ctx.actors.alice, regFee, {from: ctx.actors.owner})
      const beforePoolBal = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      const beforeAliceBal = await ctx.contracts.token.balanceOf(ctx.actors.alice)
      const bountyStartingBal = await ctx.contracts.atonomi.pools(ctx.actors.mfg)

      const isIrnAdmin = false
      const isMFG = true
      const isIrnNode = false
      await testAdd(ctx.actors.mfg,
        isIrnAdmin, isMFG, isIrnNode, memberId,
        ctx.actors.owner)
      await ctx.contracts.token.approve(ctx.contracts.atonomi.address, regFee, {from: ctx.actors.alice})

      const success = await ctx.contracts.atonomi.depositTokens.call(memberId, regFee, {from: ctx.actors.alice})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.depositTokens(memberId, regFee, {from: ctx.actors.alice})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('TokensDeposited')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.alice)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(memberId)
      expect(tx.logs[0].args._manufacturer).to.be.equal(ctx.actors.mfg)
      expect(tx.logs[0].args._amount.toString(10)).to.be.equal(regFee.toString(10))

      const afterPoolBal = await ctx.contracts.token.balanceOf(ctx.contracts.atonomi.address)
      const afterAliceBal = await ctx.contracts.token.balanceOf(ctx.actors.alice)
      const bountyEndingBal = await ctx.contracts.atonomi.pools(ctx.actors.mfg)
      expect((afterPoolBal - beforePoolBal).toString(10)).to.be.equal(regFee.toString(10))
      expect((beforeAliceBal - afterAliceBal).toString(10)).to.be.equal(regFee.toString(10))
      expect((bountyEndingBal[0] - bountyStartingBal[0]).toString(10)).to.be.equal(regFee.toString(10))
    })
  })
})
