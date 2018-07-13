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

// EXAMPLE:
// > var myPending = []
// > getParityPendingTransactions(ETHER_ADDR, function(err, results) { myPending = results })
function getParityPendingTransactions(account, cb) {
  web3.currentProvider.sendAsync({
    jsonrpc: '2.0',
    method: 'parity_pendingTransactions',
    params: [],
    id: 1
  }, function(err, results) {
    cb(err, results.result.filter(function(item) {
      return item.from === account
    }))
  })
}
