import { expect } from 'chai'
const EternalStorage = artifacts.require('EternalStorage')
const init = require('./helpers/init')

contract('EternalStorage', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      storage: null
    }
  }

  beforeEach(async () => {
    ctx.contracts.storage = await EternalStorage.new({from: ctx.actors.owner})
  })

  const testCases = [
    { name: 'Address', key: 'myaddresskey', value: ctx.actors.alice, deleteValue: '0x0000000000000000000000000000000000000000' }
  ]
  testCases.forEach((testCase) => {
    describe(testCase.name, () => {
      const key = testCase.key
      const value = testCase.value

      beforeEach(async () => {
        await ctx.contracts.storage[`set${testCase.name}`](key, value, {from: ctx.actors.owner})
      })

      it('can set', async () => {
        const actual = await ctx.contracts.storage[`get${testCase.name}`](key)
        expect(actual).to.be.equal(value)
      })

      it('can delete', async () => {
        await ctx.contracts.storage[`delete${testCase.name}`](key)
        const actual = await ctx.contracts.storage[`get${testCase.name}`](key)
        expect(actual).to.be.equal(testCase.deleteValue)
      })
    })
  })
})
