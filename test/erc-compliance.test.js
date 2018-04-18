import { expect } from 'chai'
const errors = require('./helpers/errors')
const MockContractReceiver = artifacts.require('MockContractReceiver')
const ethjsABI = require('ethjs-abi')
const abiHelper = require('./helpers/abi')
const init = require('./helpers/init')

contract('ATMI ERC Compliance', accounts => {
  const ctx = {
    actors: init.getTestActorsContext(accounts),
    contracts: {
      atonomi: null,
      receiverMock: null
    }
  }

  const tokenName = 'Atonomi Token'
  const tokenSymbol = 'ATMI'
  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const initalSupply = 1000000000 * multiplier

  beforeEach(async () => {
    ctx.contracts.atonomi = await init.getAtonomiTokenContract(ctx.actors.owner, ctx.actors.releaseAgent)
    ctx.contracts.receiverMock = await MockContractReceiver.new({from: ctx.actors.owner})
  })

  describe('initialized', () => {
    it('has name: ' + tokenName, async () => {
      const name = await ctx.contracts.atonomi.name.call()
      expect(name).to.equal(tokenName)
    })

    it('has symbol: ' + tokenSymbol, async () => {
      const symbol = await ctx.contracts.atonomi.symbol.call()
      expect(symbol).to.equal(tokenSymbol)
    })

    it('has decimals: ' + tokenDecimals, async () => {
      const decimals = await ctx.contracts.atonomi.decimals.call()
      expect(decimals.toNumber()).to.equal(tokenDecimals)
    })

    it('has minted: ' + (initalSupply / multiplier).toLocaleString(), async () => {
      const receipt = web3.eth.getTransactionReceipt(ctx.contracts.atonomi.transactionHash)
      expect(receipt.logs.length).to.be.equal(1)
      const decoder = ethjsABI.logDecoder(ctx.contracts.atonomi.abi)
      const tokenEvents = decoder(receipt.logs)
      const log = tokenEvents[0]
      expect(log._eventName).to.be.equal('Minted')
      expect(log.receiver).to.be.equal(ctx.actors.owner)
      expect(log.amount.toString(10)).to.be.equal('1000000000000000000000000000')
    })

    it('has totalSupply: ' + (initalSupply / multiplier).toLocaleString(), async () => {
      const totalSupply = await ctx.contracts.atonomi.totalSupply.call()
      expect(totalSupply.toNumber()).to.equal(initalSupply)
    })

    it('can get balanceOf token owner', async () => {
      const ownerBalance = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      expect(ownerBalance.toNumber()).to.equal(initalSupply)
    })
  })

  describe('transfer', () => {
    const transferAmount = 1 * multiplier

    it('can transfer 1 token', async () => {
      const success = await ctx.contracts.atonomi.transfer.call(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.transfer(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      expect(tx.logs.length).to.be.equal(1)

      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.actors.alice)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const balances = { owner: 0, alice: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.alice = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferAmount)
      expect(balances.alice.toNumber()).to.be.equal(transferAmount)
    })

    it('can transfer zero token', async () => {
      const transferZero = 0
      const success = await ctx.contracts.atonomi.transfer.call(ctx.actors.alice, transferZero, { from: ctx.actors.owner })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.transfer(ctx.actors.alice, transferZero, { from: ctx.actors.owner })
      expect(tx.logs.length).to.be.equal(1)

      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.actors.alice)
      expect(log.args.value.toNumber()).to.be.equal(transferZero)

      const balances = { owner: 0, alice: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.alice = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferZero)
      expect(balances.alice.toNumber()).to.be.equal(transferZero)
    })

    it('can not transfer with insufficient tokens', async () => {
      const aliceBalance = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      expect(aliceBalance.toNumber()).to.be.lessThan(transferAmount)
      const fn = ctx.contracts.atonomi.transfer(ctx.actors.bob, transferAmount, { from: ctx.actors.alice })
      await errors.expectRevert(fn)
    })
  })

  describe('transfer 1 token with function callback', () => {
    const transferAmount = 1 * multiplier

    it('can transfer 1 token', async () => {
      const testNumber = 24
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transfer', 'address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])
      const tx = await ctx.contracts.atonomi.sendTransaction({from: ctx.actors.owner, data: transferData})

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.receiverMock.abi)
      const mockEvents = decoder(tx.receipt.logs)
      const mockLog = mockEvents[0]
      expect(mockLog._eventName).to.be.equal('TestLog')
      expect(mockLog.n.toNumber()).to.be.equal(testNumber)

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.contracts.receiverMock.address)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const balances = { owner: 0, receiverMock: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.receiverMock = await ctx.contracts.atonomi.balanceOf.call(ctx.contracts.receiverMock.address)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferAmount)
      expect(balances.receiverMock.toNumber()).to.be.equal(transferAmount)
    })

    it('can transfer zero token', async () => {
      const transferZero = 0

      const testNumber = 24
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transfer', 'address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferZero, callbackData])
      const tx = await ctx.contracts.atonomi.sendTransaction({from: ctx.actors.owner, data: transferData})

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.receiverMock.abi)
      const mockEvents = decoder(tx.receipt.logs)
      const mockLog = mockEvents[0]
      expect(mockLog._eventName).to.be.equal('TestLog')
      expect(mockLog.n.toNumber()).to.be.equal(testNumber)

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.contracts.receiverMock.address)
      expect(log.args.value.toNumber()).to.be.equal(transferZero)

      const balances = { owner: 0, receiverMock: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.receiverMock = await ctx.contracts.atonomi.balanceOf.call(ctx.contracts.receiverMock.address)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferZero)
      expect(balances.receiverMock.toNumber()).to.be.equal(transferZero)
    })

    it('can not transfer with insufficient funds', async () => {
      const balance = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      expect(balance.toNumber()).to.be.lessThan(transferAmount)

      const testNumber = 24
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transfer', 'address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])

      const fn = ctx.contracts.atonomi.sendTransaction({from: ctx.actors.alice, data: transferData})
      await errors.expectRevert(fn)
    })
  })

  describe('approve', () => {
    const transferAmount = 1 * multiplier

    it('can approve a transfer', async () => {
      const success = await ctx.contracts.atonomi.approve.call(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      expect(tx.logs.length).to.be.equal(1)

      const log = tx.logs[0]
      expect(log.event).to.be.equal('Approval')
      expect(log.args.owner).to.be.equal(ctx.actors.owner)
      expect(log.args.spender).to.be.equal(ctx.actors.alice)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      expect(allowance.toNumber()).to.be.equal(transferAmount)
    })

    it('can increase approval allowance', async () => {
      const initialAllowance = transferAmount
      await ctx.contracts.atonomi.approve(ctx.actors.alice, initialAllowance, { from: ctx.actors.owner })

      const increasedAllowance = transferAmount * 2
      // TruffleContract is currently bugged, having issues with function overloads, need to call it this way
      await ctx.contracts.atonomi.contract.increaseApproval['address,uint256'].sendTransaction(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      expect(allowance.toNumber()).to.be.equal(increasedAllowance)
    })

    it('can decrease approval allowance', async () => {
      const initialAllowance = transferAmount
      await ctx.contracts.atonomi.approve(ctx.actors.alice, initialAllowance, { from: ctx.actors.owner })

      const decreasedAllowance = transferAmount / 2
      await ctx.contracts.atonomi.decreaseApproval(ctx.actors.alice, transferAmount / 2, { from: ctx.actors.owner })

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      expect(allowance.toNumber()).to.be.equal(decreasedAllowance)
    })
  })

  describe('approve a transfer with function callback', () => {
    const transferAmount = 1 * multiplier

    it('can approve a transfer', async () => {
      const testNumber = 8
      const callbackData = ctx.contracts.receiverMock.contract.onTokenApprove.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'approve', 'address,uint256,bytes')
      const approveData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])
      const tx = await ctx.contracts.atonomi.sendTransaction({ from: ctx.actors.owner, data: approveData })

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.receiverMock.abi)
      const mockEvents = decoder(tx.receipt.logs)
      const mockLog = mockEvents[0]
      expect(mockLog._eventName).to.be.equal('TestLog')
      expect(mockLog.n.toNumber()).to.be.equal(testNumber)

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('Approval')
      expect(log.args.owner).to.be.equal(ctx.actors.owner)
      expect(log.args.spender).to.be.equal(ctx.contracts.receiverMock.address)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.contracts.receiverMock.address)
      expect(allowance.toNumber()).to.be.equal(transferAmount)
    })

    it('can increase approval allowance', async () => {
      const intialAllowance = transferAmount
      let testNumber = 8
      let callbackData = ctx.contracts.receiverMock.contract.onTokenApprove.getData(testNumber)
      let abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'approve', 'address,uint256,bytes')
      let approveData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, intialAllowance, callbackData])
      await ctx.contracts.atonomi.sendTransaction({ from: ctx.actors.owner, data: approveData })

      const increasedAllowance = transferAmount * 2
      testNumber = 8 * 2
      callbackData = ctx.contracts.receiverMock.contract.onTokenApprove.getData(testNumber)
      abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'increaseApproval', 'address,uint256,bytes')
      approveData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])
      await ctx.contracts.atonomi.sendTransaction({ from: ctx.actors.owner, data: approveData })

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.contracts.receiverMock.address)
      expect(allowance.toNumber()).to.be.equal(increasedAllowance)
    })

    it('can decrease approval allowance', async () => {
      const intialAllowance = transferAmount
      let testNumber = 8
      let callbackData = ctx.contracts.receiverMock.contract.onTokenApprove.getData(testNumber)
      let abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'approve', 'address,uint256,bytes')
      let approveData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, intialAllowance, callbackData])
      await ctx.contracts.atonomi.sendTransaction({ from: ctx.actors.owner, data: approveData })

      const decreasedAllowance = transferAmount / 2
      testNumber = 8 / 2
      callbackData = ctx.contracts.receiverMock.contract.onTokenApprove.getData(testNumber)
      abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'decreaseApproval', 'address,uint256,bytes')
      approveData = ethjsABI.encodeMethod(abiMethod, [ctx.contracts.receiverMock.contract.address, transferAmount / 2, callbackData])
      await ctx.contracts.atonomi.sendTransaction({ from: ctx.actors.owner, data: approveData })

      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.contracts.receiverMock.address)
      expect(allowance.toNumber()).to.be.equal(decreasedAllowance)
    })
  })

  describe('transferFrom', () => {
    const transferAmount = 1 * multiplier

    it('can transfer 1 token with approval', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })

      const success = await ctx.contracts.atonomi.transferFrom.call(ctx.actors.owner, ctx.actors.bob, transferAmount, { from: ctx.actors.alice })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.transferFrom(ctx.actors.owner, ctx.actors.bob, transferAmount, { from: ctx.actors.alice })
      expect(tx.logs.length).to.be.equal(1)

      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.actors.bob)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const balances = { owner: 0, alice: 0, bob: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.alice = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      balances.bob = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.bob)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferAmount)
      expect(balances.alice.toNumber()).to.be.equal(0)
      expect(balances.bob.toNumber()).to.be.equal(transferAmount)
    })

    it('can transfer zero token with approval', async () => {
      const transferZero = 0
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })

      const success = await ctx.contracts.atonomi.transferFrom.call(ctx.actors.owner, ctx.actors.bob, transferZero, { from: ctx.actors.alice })
      expect(success).to.be.equal(true)

      const tx = await ctx.contracts.atonomi.transferFrom(ctx.actors.owner, ctx.actors.bob, transferZero, { from: ctx.actors.alice })
      expect(tx.logs.length).to.be.equal(1)

      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.actors.bob)
      expect(log.args.value.toNumber()).to.be.equal(transferZero)

      const balances = { owner: 0, alice: 0, bob: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.alice = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.alice)
      balances.bob = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.bob)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferZero)
      expect(balances.alice.toNumber()).to.be.equal(0)
      expect(balances.bob.toNumber()).to.be.equal(transferZero)
    })

    it('can not transfer without approval', async () => {
      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      expect(allowance.toNumber()).to.be.equal(0)

      const fn = ctx.contracts.atonomi.transferFrom(ctx.actors.owner, ctx.actors.bob, transferAmount, { from: ctx.actors.alice })
      await errors.expectRevert(fn)
    })

    it('can not transfer more than allowed', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      const badAmount = transferAmount * 2
      expect(allowance.toNumber()).to.be.greaterThan(0)
      expect(allowance.toNumber()).to.be.lessThan(badAmount)

      const fn = ctx.contracts.atonomi.transferFrom(ctx.actors.owner, ctx.actors.bob, badAmount, { from: ctx.actors.alice })
      await errors.expectRevert(fn)
    })

    it('can not transfer with insufficient funds', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.bob, transferAmount, { from: ctx.actors.alice })

      const balance = await ctx.contracts.atonomi.balanceOf(ctx.actors.alice)
      expect(balance.toNumber()).to.be.lessThan(transferAmount)

      const fn = ctx.contracts.atonomi.transferFrom(ctx.actors.alice, ctx.actors.bob, transferAmount, { from: ctx.actors.bob })
      await errors.expectRevert(fn)
    })
  })

  describe('transferFrom with function callback', () => {
    const transferAmount = 1 * multiplier

    it('can transfer 1 token with approval', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })

      const testNumber = 241
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transferFrom', 'address,address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.actors.owner, ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])
      const tx = await ctx.contracts.atonomi.sendTransaction({from: ctx.actors.alice, data: transferData})

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.receiverMock.abi)
      const mockEvents = decoder(tx.receipt.logs)
      const mockLog = mockEvents[0]
      expect(mockLog._eventName).to.be.equal('TestLog')
      expect(mockLog.n.toNumber()).to.be.equal(testNumber)

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.contracts.receiverMock.address)
      expect(log.args.value.toNumber()).to.be.equal(transferAmount)

      const balances = { owner: 0, receiverMock: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.receiverMock = await ctx.contracts.atonomi.balanceOf.call(ctx.contracts.receiverMock.address)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferAmount)
      expect(balances.receiverMock.toNumber()).to.be.equal(transferAmount)
    })

    it('can transfer zero token with approval', async () => {
      const transferZero = 0
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })

      const testNumber = 241
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transferFrom', 'address,address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.actors.owner, ctx.contracts.receiverMock.contract.address, transferZero, callbackData])
      const tx = await ctx.contracts.atonomi.sendTransaction({from: ctx.actors.alice, data: transferData})

      expect(tx.receipt.logs.length).to.be.equal(2)
      const decoder = ethjsABI.logDecoder(ctx.contracts.receiverMock.abi)
      const mockEvents = decoder(tx.receipt.logs)
      const mockLog = mockEvents[0]
      expect(mockLog._eventName).to.be.equal('TestLog')
      expect(mockLog.n.toNumber()).to.be.equal(testNumber)

      expect(tx.logs.length).to.be.equal(1)
      const log = tx.logs[0]
      expect(log.event).to.be.equal('Transfer')
      expect(log.args.from).to.be.equal(ctx.actors.owner)
      expect(log.args.to).to.be.equal(ctx.contracts.receiverMock.address)
      expect(log.args.value.toNumber()).to.be.equal(transferZero)

      const balances = { owner: 0, receiverMock: 0 }
      balances.owner = await ctx.contracts.atonomi.balanceOf.call(ctx.actors.owner)
      balances.receiverMock = await ctx.contracts.atonomi.balanceOf.call(ctx.contracts.receiverMock.address)
      expect(balances.owner.toNumber()).to.be.equal(initalSupply - transferZero)
      expect(balances.receiverMock.toNumber()).to.be.equal(transferZero)
    })

    it('can not transfer without approval', async () => {
      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      expect(allowance.toNumber()).to.be.equal(0)

      const testNumber = 241
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transferFrom', 'address,address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.actors.owner, ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])

      const fn = ctx.contracts.atonomi.sendTransaction({from: ctx.actors.alice, data: transferData})
      await errors.expectRevert(fn)
    })

    it('can not transfer more than allowed', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.alice, transferAmount, { from: ctx.actors.owner })
      const allowance = await ctx.contracts.atonomi.allowance.call(ctx.actors.owner, ctx.actors.alice)
      const badAmount = transferAmount * 2
      expect(allowance.toNumber()).to.be.greaterThan(0)
      expect(allowance.toNumber()).to.be.lessThan(badAmount)

      const testNumber = 241
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transferFrom', 'address,address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.actors.owner, ctx.contracts.receiverMock.contract.address, badAmount, callbackData])

      const fn = ctx.contracts.atonomi.sendTransaction({from: ctx.actors.alice, data: transferData})
      await errors.expectRevert(fn)
    })

    it('can not transfer with insufficient funds', async () => {
      await ctx.contracts.atonomi.approve(ctx.actors.bob, transferAmount, { from: ctx.actors.alice })
      const balance = await ctx.contracts.atonomi.balanceOf(ctx.actors.alice)
      expect(balance.toNumber()).to.be.lessThan(transferAmount)

      const testNumber = 241
      const callbackData = ctx.contracts.receiverMock.contract.onTokenTransfer.getData(testNumber)
      const abiMethod = abiHelper.findMethod(ctx.contracts.atonomi.abi, 'transferFrom', 'address,address,uint256,bytes')
      const transferData = ethjsABI.encodeMethod(abiMethod, [ctx.actors.alice, ctx.contracts.receiverMock.contract.address, transferAmount, callbackData])

      const fn = ctx.contracts.atonomi.sendTransaction({from: ctx.actors.bob, data: transferData})
      await errors.expectRevert(fn)
    })
  })
})
