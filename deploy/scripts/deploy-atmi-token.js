if (!SAFEMATHLIB_ADDR) {
  function initSafeMathLib() {
    console.log('Configuring SafeMathLib...')
    var safeMathByteCode = web3.eth.contract(SafeMathLibJSON.abi).new.getData({data: SafeMathLibJSON.bytecode})
    var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: safeMathByteCode})
    var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: safeMathByteCode, gas: gas})
    console.log('Transaction Hash:', hash)
    waitForTransactionReceipt(hash, function (receipt) {
      var SafeMathLib = web3.eth.contract(SafeMathLibJSON.abi).at(receipt.contractAddress)
      console.log('SafeMathLib published at', SafeMathLib.address)
      console.log('status', receipt.status)
      console.log('gas used', receipt.gasUsed)
      SAFEMATHLIB_ADDR = receipt.contractAddress
    })
  }
  initSafeMathLib()
} else {
  var SafeMathLib = web3.eth.contract(SafeMathLibJSON.abi).at(SAFEMATHLIB_ADDR)
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
    var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
    console.log('Transaction Hash', hash)
    console.log('gas estimate', gas)
    waitForTransactionReceipt(hash, function (receipt) {
      var ATMIToken = web3.eth.contract(AtonomiTokenJSON.abi).at(receipt.contractAddress)
      console.log('ATMIToken published at', ATMIToken.address)
      console.log('status', receipt.status)
      console.log('gas used', receipt.gasUsed)
      ATMI_ADDR = receipt.contractAddress
    })
  }
  initATMIToken()
} else {
  var ATMIToken = web3.eth.contract(AtonomiTokenJSON.abi).at(ATMI_ADDR)
  console.log('ATMIToken published at ' + ATMIToken.address)
}