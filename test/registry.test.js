import { TestApp } from 'zos'
import { expect } from 'chai'
const NetworkSettings = artifacts.require('NetworkSettings')
const Registry = artifacts.require('Registry')
const web3Utils = require('web3-utils')
const errors = require('./helpers/errors')
const init = require('./helpers/init')

contract('Registry', accounts => {
  let app

  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      device: null,
      settings: null,
      storage: null,
      member: null,
      pool: null,
      token: null,
      reputation: null,
      registry: null
    }
  }

  const itemAddress = 0x12345

  const tokenDecimals = 3
  const multiplier = 10 ** tokenDecimals
  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier

  beforeEach(async () => {
    app = await TestApp({ from: ctx.actors.owner })
    
    ctx.contracts.registry = await init.getRegistryContract(ctx.actors.owner)
    ctx.contracts.storage = await init.getStorageContract(ctx.contracts.registry.address, ctx.actors.owner)
  })
  describe('add()', function () {

    describe('when the given id is not in the items mapping', function () {
      beforeEach(async function () {
        this.logs = (await this.registry.add(itemAddress)).logs
      })

      it('adds the id to the items mapping', async function () {
        expect(await this.registry.exists(itemAddress)).to.be.true
      })

      it('emits an ItemAdded event', function () {
        expectEvent.inLogs(this.logs, 'ItemAdded', { id: itemAddress })
      })
    })

    describe('when the given id is in the items mapping', function () {
      it('reverts', async function () {
        await this.registry.add(itemAddress)
        await shouldFail.reverting(this.registry.add(itemAddress))
      })
    })
  })
  describe('remove()', function () {

    describe('when the given id is in the items mapping', function () {
      beforeEach(async function () {
        await this.registry.add(itemAddress)
        this.logs = (await this.registry.remove(itemAddress)).logs
      })

      it('removes the id from the items mapping', async function () {
        expect(await this.registry.exists(itemAddress)).to.be.false
      })

      it('emits an ItemRemoved event', function () {
        expectEvent.inLogs(this.logs, 'ItemRemoved', { id: itemAddress })
      })
    })

    describe('when the given id is not in the items mapping', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.registry.remove(itemAddress))
      })
    })

  })
  describe('exists()', function () {

    describe('when given id that exists', function () {
      it('returns true', async function () {
        await this.registry.add(itemAddress)
        expect(await this.registry.exists(itemAddress)).to.be.true
      })
    })

    describe('when given id that does not exist', function () {
      it('returns false', async function () {
        expect(await this.registry.exists(itemAddress)).to.be.false
      })
    })
  })
})