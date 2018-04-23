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

  describe('IRN Node and MFG mappings', () => {
    const mfgId = 'APPLE'

    it('owner can map', async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})

      const success = await ctx.contracts.atonomi.mapManufacturerToIRNNode.call(ctx.actors.irnNode, mfgId, {from: ctx.actors.owner})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.mapManufacturerToIRNNode(ctx.actors.irnNode, mfgId, {from: ctx.actors.owner})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ManufacturerMapped')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.owner)
      expect(tx.logs[0].args._irnNode).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)

      const lookup = await ctx.contracts.atonomi.iRNLookup(mfgId)
      expect(lookup).to.be.equal(ctx.actors.irnNode)
    })

    it('irn admin can map', async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})

      const success = await ctx.contracts.atonomi.mapManufacturerToIRNNode.call(ctx.actors.irnNode, mfgId, {from: ctx.actors.admin})
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.mapManufacturerToIRNNode(ctx.actors.irnNode, mfgId, {from: ctx.actors.admin})
      expect(tx.logs.length).to.be.equal(1)
      expect(tx.logs[0].event).to.be.equal('ManufacturerMapped')
      expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.admin)
      expect(tx.logs[0].args._irnNode).to.be.equal(ctx.actors.irnNode)
      expect(web3.toAscii(tx.logs[0].args._manufacturerId).replace(/\u0000/g, '')).to.be.equal(mfgId)

      const lookup = await ctx.contracts.atonomi.iRNLookup(mfgId)
      expect(lookup).to.be.equal(ctx.actors.irnNode)
    })

    it('external accounts can not map', async () => {
      await ctx.contracts.atonomi.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})

      const owner = await ctx.contracts.atonomi.owner.call()
      expect(ctx.actors.bob).not.to.be.equal(owner)

      const m = await ctx.contracts.atonomi.network(ctx.actors.bob)
      expect(m[0]).not.to.equal(true)

      const fn = ctx.contracts.atonomi.mapManufacturerToIRNNode(ctx.actors.irnNode, mfgId, {from: ctx.actors.bob})
      await errors.expectRevert(fn)
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

      it('IRN admin can set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const success = await ctx.contracts.atonomi.setRegistrationFee.call(newRegFee, {from: ctx.actors.admin})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setRegistrationFee(newRegFee, {from: ctx.actors.admin})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('RegistrationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.admin)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRegFee.toString(10))

        const fee = await ctx.contracts.atonomi.registrationFee()
        expect(fee.toString(10)).to.be.equal(newRegFee.toString(10))
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

      it('IRN admin can set fee', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const success = await ctx.contracts.atonomi.setActivationFee.call(newActFee, {from: ctx.actors.admin})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setActivationFee(newActFee, {from: ctx.actors.admin})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ActivationFeeUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.admin)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newActFee.toString(10))

        const fee = await ctx.contracts.atonomi.activationFee()
        expect(fee.toString(10)).to.be.equal(newActFee.toString(10))
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

      it('IRN admin can set reward', async () => {
        await ctx.contracts.atonomi.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const success = await ctx.contracts.atonomi.setReputationReward.call(newRepReward, {from: ctx.actors.admin})
        expect(success).to.be.equal(true)

        const tx = await ctx.contracts.atonomi.setReputationReward(newRepReward, {from: ctx.actors.admin})
        expect(tx.logs.length).to.be.equal(1)
        expect(tx.logs[0].event).to.be.equal('ReputationRewardUpdated')
        expect(tx.logs[0].args._sender).to.be.equal(ctx.actors.admin)
        expect(tx.logs[0].args._amount.toString(10)).to.be.equal(newRepReward.toString(10))

        const fee = await ctx.contracts.atonomi.reputationReward()
        expect(fee.toString(10)).to.be.equal(newRepReward.toString(10))
      })

      it('external accounts cannot set reward', async () => {
        const fn = ctx.contracts.atonomi.setReputationReward(newRepReward, {from: ctx.actors.alice})
        await errors.expectRevert(fn)
      })
    })
  })
})
