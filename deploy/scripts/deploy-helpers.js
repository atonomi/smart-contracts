// helper function to wait for mining times
function waitForTransactionReceipt (hash, callback) {
  console.log('waiting for txn to be mined...')
  var receipt = web3.eth.getTransactionReceipt(hash)
  if (receipt === null) {
      setTimeout(function () {
        console.log('retry after 5 seconds...')
        waitForTransactionReceipt(hash)
      }, 5000)
  } else {
      if(callback) {
        console.log('mined!')
        callback(receipt)
      }
  }
}