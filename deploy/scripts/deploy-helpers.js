// helper function to wait for mining times
function getTransactionReceipt (hash) {
  var receipt = web3.eth.getTransactionReceipt(hash)
  if (receipt === null) {
    console.log('not found, retry later')
  } else {
    console.log(receipt)
  }
  return receipt
}

function isSyncing() {
  if (eth.syncing === false) {
    console.log("Synchronized!")
  } else {
    console.log(eth.syncing.currentBlock / eth.syncing.highestBlock, "%")
  }
}