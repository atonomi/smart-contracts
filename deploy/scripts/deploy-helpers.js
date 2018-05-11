// helper function to wait for mining times
function waitForTransactionReceipt (hash) {
  var receipt = web3.eth.getTransactionReceipt(hash)
  if (receipt === null) {
    console.log('not found, retry later')
  } else {
    console.log(receipt)
  }
  return receipt
}