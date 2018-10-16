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
    { name: 'Address', key: 'myaddresskey', value: ctx.actors.alice, deleteValue: '0x0000000000000000000000000000000000000000' },
    { name: 'Uint', key: 'myuintkey', value: 10528, deleteValue: '0' },
    { name: 'String', key: 'mystringkey', value: 'fil', deleteValue: '' },
    { name: 'Bytes', key: 'mybyteskey', value: 0x123456, deleteValue: '0x' },
    { name: 'Bytes32', key: 'mybytes32key', value: 0x1234567890, deleteValue: '0x0000000000000000000000000000000000000000000000000000000000000000' },
    { name: 'Bool', key: 'myboolkey', value: true, deleteValue: 'false' },
    { name: 'Int', key: 'myintkey', value: 82501, deleteValue: '0' }
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
        let stringValue = value.toString()
        if (testCase.name === 'Bytes') {
          stringValue = '0x' + value.toString(16)
        } else if (testCase.name === 'Bytes32') {
          stringValue = '0x' + value.toString(16).padEnd(64, '0')
        }
        expect(actual.toString()).to.be.equal(stringValue)
      })

      it('can delete', async () => {
        await ctx.contracts.storage[`delete${testCase.name}`](key)
        const actual = await ctx.contracts.storage[`get${testCase.name}`](key)
        expect(actual.toString()).to.be.equal(testCase.deleteValue.toString())
      })
    })
  })
})
