export function mineBlock () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine'
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}
