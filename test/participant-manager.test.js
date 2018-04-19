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
})
