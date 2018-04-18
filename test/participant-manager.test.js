/* import { expect } from 'chai'
const errors = require('./helpers/errors')
const ethjsABI = require('ethjs-abi')
const abiHelper = require('./helpers/abi')
const init = require('./helpers/init')
*/

contract('Atonomi Network Participant Manager', accounts => {
  /* const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      atonomi: null,
      receiverMock: null
    }
  } */

  beforeEach(async () => {
  })

  describe('initialized', () => {
    it('has owner', async () => {
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

    it('external accounts can not remove', async () => {
    })
  })
})
