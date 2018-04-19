// helper function to wait for mining times
function waitForTransactionReceipt (tag, hash) {
  var receipt = web3.eth.getTransactionReceipt(hash)
  if (receipt === null) {
    console.log('retry after 10 seconds...')
      setTimeout(function () {
        waitForTransactionReceipt(tag, hash)
      }, 10000)
  } else {
    console.log(tag, receipt)
  }
}