if (!SAFEMATHLIB_ADDR) {
  function initSafeMathLib() {
    console.log('Configuring SafeMathLib...')
    var safeMathByteCode = web3.eth.contract(SafeMathLibJSON.abi).new.getData({data: SafeMathLibJSON.bytecode})
    var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: safeMathByteCode})
    console.log('gas estimate', gas)
    var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: safeMathByteCode, gas: gas})
    console.log('txn hash:', hash)
    waitForTransactionReceipt('SafeMathLib', hash)
  }
  initSafeMathLib()
} else {
  console.log('SafeMathLib published at ' + SAFEMATHLIB_ADDR)
}

if(!ATMI_ADDR) {
  function initATMIToken() {
    console.log('Configuring ATMI...')
    var linkedATMIByteCode = AtonomiTokenJSON.bytecode.replace(/__SafeMathLib___________________________+/g, SAFEMATHLIB_ADDR.substring(2))
    var constructorByteCode = web3.eth.contract(AtonomiTokenJSON.abi).new.getData(
      'Atonomi Token',
      'ATMI',
      1000000000000000000000000000,
      18,
      false,
      {data: linkedATMIByteCode})
    var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
    console.log('gas estimate', gas)
    var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
    console.log('txn hash', hash)
    waitForTransactionReceipt('ATMIToken', hash)
  }
  initATMIToken()
} else {
  console.log('ATMIToken published at ' + ATMI_ADDR)
}