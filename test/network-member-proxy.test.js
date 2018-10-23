import { TestApp } from 'zos'
import { expect } from 'chai'
const NetworkMemberManager = artifacts.require('NetworkMemberManager')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Network Member', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      storage: null,
      members: null,
      tokenpool: null
    }
  }

  const testAdd = async (newMember, isIrnAdmin, isMFG, isIrnNode, memberId, from) => {
    const success = await ctx.contracts.members.addNetworkMember.call(
      newMember,
      isIrnAdmin,
      isMFG,
      isIrnNode,
      memberId,
      { from: from })
    expect(success).to.be.equal(true)

    const tx = await ctx.contracts.members.addNetworkMember(
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

    expect(await ctx.contracts.members.isIRNAdmin.call(newMember)).to.be.equal(isIrnAdmin)
    expect(await ctx.contracts.members.isManufacturer.call(newMember)).to.be.equal(isMFG)
    expect(await ctx.contracts.members.isIRNNode.call(newMember)).to.be.equal(isIrnNode)
    expect(web3.toAscii((await ctx.contracts.members.memberId.call(newMember))).replace(/\u0000/g, '')).to.be.equal(memberId)
  }

  const testRemove = async (member, memberId, from) => {
    const success = await ctx.contracts.members.removeNetworkMember.call(member, {from: from})
    expect(success).to.be.equal(true)

    const tx = await ctx.contracts.members.removeNetworkMember(member, {from: from})
    expect(tx.logs.length).to.be.equal(1)
    expect(tx.logs[0].event).to.be.equal('NetworkMemberRemoved')
    expect(tx.logs[0].args._sender).to.be.equal(from)
    expect(tx.logs[0].args._member).to.be.equal(member)
    expect(web3.toAscii(tx.logs[0].args._memberId).replace(/\u0000/g, '')).to.be.equal(memberId)
    expect(await ctx.contracts.members.isIRNAdmin.call(member)).to.be.equal(false)
    expect(await ctx.contracts.members.isManufacturer.call(member)).to.be.equal(false)
    expect(await ctx.contracts.members.isIRNNode.call(member)).to.be.equal(false)
    expect(web3.toAscii((await ctx.contracts.members.memberId.call(member))).replace(/\u0000/g, '')).to.be.equal('')
  }

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    ctx.contracts.storage = await init.getStorageContract(ctx.actors.owner)
    ctx.contracts.members = await init.getNetworkMemberContract(app, ctx.actors.owner, ctx.contracts.storage.address)
  })

  describe('proxy cannot be initialized', () => {
    it('owner cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
        0x0,
        ctx.contracts.storage.address]
      )
      await errors.expectRevert(fn)
    })

    it('storage cannot be 0x0', async () => {
      const fn = app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
        ctx.actors.owner,
        0x0]
      )
      await errors.expectRevert(fn)
    })
  })

  describe('proxy initialized', () => {
    it('has correct default values', async () => {
      const owner = await ctx.contracts.members.owner.call()
      expect(owner).to.be.equal(ctx.actors.owner)

      const storageAddr = await ctx.contracts.members.atonomiStorage.call()
      expect(storageAddr).to.be.equal(ctx.contracts.storage.address)

      const reward = await ctx.contracts.members.defaultReputationReward.call()
      expect(parseInt(reward)).to.be.at.least(0)
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
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = true
        const isMFG = false
        const isIrnNode = false
        const memberId = ''

        await testAdd(ctx.actors.alice,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.addNetworkMember(ctx.actors.alice, true, false, false, '', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove IRN admin', () => {
      beforeEach(async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})
      })

      it('owner can remove', async () => {
        const member = ctx.actors.admin
        const from = ctx.actors.owner
        await testRemove(member, '', from)
      })

      it('irn admin can remove', async () => {
        await ctx.contracts.members.addNetworkMember(ctx.actors.alice, true, false, false, '', {from: ctx.actors.owner})

        const member = ctx.actors.alice
        const from = ctx.actors.admin
        await testRemove(member, '', from)
      })

      it('external accounts can not remove', async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.removeNetworkMember(ctx.actors.admin, {from: ctx.actors.bob})
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
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = false
        const isMFG = false
        const isIrnNode = true
        const memberId = ''
        await testAdd(ctx.actors.alice,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.addNetworkMember(ctx.actors.alice, false, false, true, '', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove IRN node', () => {
      beforeEach(async () => {
        const owner = await ctx.contracts.members.owner.call()

        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        expect(ctx.actors.irnNode).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.irnNode, false, false, true, '', {from: ctx.actors.owner})
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
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.removeNetworkMember(ctx.actors.irnNode, {from: ctx.actors.bob})
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

      it('cannot add without valid id', async () => {
        const fn = ctx.contracts.members.addNetworkMember(
          0x1,
          true,
          true,
          true,
          '',
          { from: ctx.actors.admin })
        await errors.expectRevert(fn)
      })

      it('IRN admin can add', async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        const isIrnAdmin = false
        const isMFG = true
        const isIrnNode = false
        const memberId = 'APPLE'
        await testAdd(ctx.actors.mfg,
          isIrnAdmin, isMFG, isIrnNode, memberId,
          ctx.actors.admin)
      })

      it('external accounts can not add', async () => {
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.addNetworkMember(ctx.actors.alice, false, true, false, 'APPLE', {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })

    describe('remove MFG', () => {
      const mfgId = 'APPLE'

      beforeEach(async () => {
        const owner = await ctx.contracts.members.owner.call()

        expect(ctx.actors.admin).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.admin, true, false, false, '', {from: ctx.actors.owner})

        expect(ctx.actors.mfg).not.to.be.equal(owner)
        await ctx.contracts.members.addNetworkMember(ctx.actors.mfg, false, true, false, mfgId, {from: ctx.actors.owner})

        // TODO check that token pool is removed if manufacturer's pool is empty, it is removes
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
        const owner = await ctx.contracts.members.owner.call()
        expect(ctx.actors.bob).not.to.be.equal(owner)

        expect(await ctx.contracts.members.isIRNAdmin.call(ctx.actors.bob)).not.to.equal(true)

        const fn = ctx.contracts.members.removeNetworkMember(ctx.actors.mfg, {from: ctx.actors.bob})
        await errors.expectRevert(fn)
      })
    })
  })
})
