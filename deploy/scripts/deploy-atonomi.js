var tokenName = 'Atonomi Token'
var tokenSymbol = 'ATMI'
var tokenDecimals = 18
var multiplier = Math.pow(10, tokenDecimals)
var regFee = 1 * multiplier
var actFee = 1 * multiplier
var repReward = 1 * multiplier
var reputationShare = 20
var blockThreshold = 5760 // assuming 15s blocks, 1 write per day
var initalSupply = 1000000000 * multiplier

function initSafeMathLib() {
  console.log('Configuring SafeMathLib...')
  var safeMathByteCode = web3.eth.contract(SafeMathLibJSON.abi).new.getData({data: SafeMathLibJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: safeMathByteCode})
  console.log('gas estimate', gas)
  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: safeMathByteCode, gas: gas})
  console.log('txn hash:', hash)
  return hash
}

function initATMIToken(safeMathAddress) {
  console.log('Configuring ATMI...')
  var linkedATMIByteCode = AtonomiTokenJSON.bytecode.replace(/__SafeMathLib___________________________+/g, safeMathAddress.substring(2))
  var constructorByteCode = web3.eth.contract(AtonomiTokenJSON.abi).new.getData(
    tokenName,
    tokenSymbol,
    initalSupply,
    tokenDecimals,
    false,
    {data: linkedATMIByteCode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  console.log('gas estimate', gas)
  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
  console.log('txn hash', hash)
  return hash
}

function initAtonomi(ercAddress) {
  console.log('Configuring Atonomi...')
  var constructorByteCode = web3.eth.contract(AtonomiJSON.abi).new.getData(
    ercAddress,
    regFee,
    actFee,
    repReward,
    reputationShare,
    blockThreshold,
    {data: AtonomiJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  console.log('gas estimate', gas)
  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
  console.log('txn hash', hash)
  return hash
}

function getATMIContract(addr) {
  return web3.eth.contract(AtonomiTokenJSON.abi).at(addr)
}

function getAtonomiContract(addr) {
  return web3.eth.contract(AtonomiJSON.abi).at(addr)
}

function initTestEnv(addr) {
  var mikeAccount = '0x079Df73b5Ce40323020E7064a6De14c1702A8bfD'

  var c = getAtonomiContract(addr)
  return c.addNetworkMember(mikeAccount, true, true, true, 'LEVELK', {from: ETHER_ADDR})
}