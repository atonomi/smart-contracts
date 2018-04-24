var tokenName = 'Atonomi Token'
var tokenSymbol = 'ATMI'
var tokenDecimals = 18
var multiplier = Math.pow(10, tokenDecimals)
var regFee = 1 * multiplier
var actFee = 1 * multiplier
var repReward = 1 * multiplier
var initalSupply = 1000000000 * multiplier

function initSafeMathLib() {
  console.log('Configuring SafeMathLib...')
  var safeMathByteCode = web3.eth.contract(SafeMathLibJSON.abi).new.getData({data: SafeMathLibJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: safeMathByteCode})
  console.log('gas estimate', gas)
  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: safeMathByteCode, gas: gas})
  console.log('txn hash:', hash)
  waitForTransactionReceipt('SafeMathLib', hash)
}

function initATMIToken() {
  console.log('Configuring ATMI...')
  var linkedATMIByteCode = AtonomiTokenJSON.bytecode.replace(/__SafeMathLib___________________________+/g, SAFEMATHLIB_ADDR.substring(2))
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
  waitForTransactionReceipt('ATMIToken', hash)
}

function initAtonomi() {
  console.log('Configuring Atonomi...')
  var constructorByteCode = web3.eth.contract(AtonomiJSON.abi).new.getData(
    ATMI_ADDR,
    regFee,
    actFee,
    repReward,
    {data: AtonomiJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  console.log('gas estimate', gas)
  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
  console.log('txn hash', hash)
  waitForTransactionReceipt('Atonomi', hash)
}
