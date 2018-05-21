var tokenName = 'Atonomi Token'
var tokenSymbol = 'ATMI'
var tokenDecimals = 18
var multiplier = Math.pow(10, tokenDecimals)
var regFee = 0.25 * multiplier
var actFee = 0.25 * multiplier
var repReward = 0.125 * multiplier
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

function initTestEnv(atonomiAddr) {
  var c = getAtonomiContract(atonomiAddr)

  var ownerAccount = ETHER_ADDR
  var h = c.addNetworkMember(ownerAccount, true, true, true, 'TEST', {from: ETHER_ADDR})
  console.log('Owner added to network', h)

  var mikeAccount = '0x079Df73b5Ce40323020E7064a6De14c1702A8bfD'
  h = c.addNetworkMember(mikeAccount, true, true, true, 'LEVK', {from: ETHER_ADDR})
  console.log('Mike added to network', h)
}

function grantTokens(atmiAddr, ethAccount) {
  var t = getATMIContract(atmiAddr)
  var h = t.transfer(ethAccount, 100 * multiplier, {from: ETHER_ADDR})
  console.log('Transfer 100 ATMI to', ethAccount, h)
}

function getAtonomiState(atonomiAddr) {
  var c = getAtonomiContract(atonomiAddr)

  var registrationFee = c.registrationFee()
  console.log('Registration Fee', (registrationFee / multiplier).toFixed(18))

  var activationFee = c.activationFee()
  console.log('Activation Fee', (activationFee / multiplier).toFixed(18))

  var defaultReputationReward = c.defaultReputationReward()
  console.log('Default Reputation Reward', (defaultReputationReward / multiplier).toFixed(18))

  var blockThreshold = c.blockThreshold()
  console.log('Reputation Block Threshold', blockThreshold)

  var reputationAuthorShare = c.reputationIRNNodeShare()
  console.log('Reputation Author Share', reputationAuthorShare + '%')
  console.log('Manufacturer Share', (100 - reputationAuthorShare) + '%')
}