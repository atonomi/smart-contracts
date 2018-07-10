var tokenName = 'Atonomi Token'
var tokenSymbol = 'ATMI'
var tokenDecimals = 18
var multiplier = Math.pow(10, tokenDecimals)
var regFee = 1 * multiplier
var actFee = 1 * multiplier
var repReward = 0.125 * multiplier
var reputationShare = 80
var blockThreshold = 5760 // assuming 15s blocks, 1 write per day
var initalSupply = 1000000000 * multiplier

var chains = {
  mainnet: {
    token: '0x97aeb5066e1a590e868b511457beb6fe99d329f5',
    atonomi: '0x899f3b22908ff5674f8237c321ab309417887606',
    settings: '0x2566c658331eac75d3b3ccd0e45c78d9cf6c4c4c'
  },
  kovan: {
    token: '0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7',
    atonomi: '0xbde8f51601e552d620c208049c5970f7b52cd044',
    settings: '0x729a741ce0c776130c50d35906f0dbd248184982'
  },
  ganache: {
    token: AtonomiTokenJSON.networks[5777] ? AtonomiTokenJSON.networks[5777].address : undefined,
    atonomi: AtonomiJSON.networks[5777] ? AtonomiJSON.networks[5777].address : undefined,
    settings: NetworkSettingsJSON.networks[5777] ? NetworkSettingsJSON.networks[5777].address : undefined
  }
}

function initSafeMathLib(estimateOnly) {
  console.log('Configuring SafeMathLib...')
  var safeMathByteCode = web3.eth.contract(SafeMathLibJSON.abi).new.getData({data: SafeMathLibJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: safeMathByteCode})
  console.log('gas estimate', gas)

  if(estimateOnly) return undefined

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: safeMathByteCode, gas: gas})
  console.log('txn hash:', hash)
  return hash
}

function initATMIToken(safeMathAddress, estimateOnly) {
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

  if(estimateOnly) return undefined

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
  console.log('txn hash', hash)
  return hash
}

function initNetworkSettings(estimateOnly, gasPriceGwei) {
  console.log('Configuring Networking Settings...')

  var gasPriceWei = web3.toWei(gasPriceGwei, 'gwei')
  console.log('gas price', gasPriceWei)

  var constructorByteCode = web3.eth.contract(NetworkSettingsJSON.abi).new.getData(
    regFee,
    actFee,
    repReward,
    reputationShare,
    blockThreshold,
    {data: NetworkSettingsJSON.bytecode})
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  console.log('gas estimate', gas)

  if(estimateOnly) return undefined

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas, gasPrice: gasPriceWei})
  console.log('txn hash', hash)
  return hash
}

function initAtonomi(ercAddress, settingsAddress, estimateOnly, gasPriceGwei) {
  console.log('Configuring Atonomi...')

  var gasPriceWei = web3.toWei(gasPriceGwei, 'gwei')
  console.log('gas price', gasPriceWei)

  var constructorByteCode = web3.eth.contract(AtonomiJSON.abi).new.getData(
    ercAddress,
    settingsAddress,
    {data: AtonomiJSON.bytecode})

  // TODO: kovan issue with estimate gas for larger contracts
  // var gas = 6500000
  var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  console.log('gas estimate', gas)

  if(estimateOnly) return undefined

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas, gasPrice: gasPriceWei})
  console.log('txn hash', hash)
  return hash
}

function getATMIContract(chain) {
  var addr = chains[chain].token
  return web3.eth.contract(AtonomiTokenJSON.abi).at(addr)
}

function getAtonomiContract(chain) {
  var addr = chains[chain].atonomi
  return web3.eth.contract(AtonomiJSON.abi).at(addr)
}

function getSettingsContract(chain) {
  var addr = chains[chain].settings
  return web3.eth.contract(NetworkSettingsJSON.abi).at(addr)
}

var testAccounts = [
  { address: ETHER_ADDR, mfgId: 'TEST' },
  { address: '0x079Df73b5Ce40323020E7064a6De14c1702A8bfD', mfgId: 'LEVK' },
  { address: '0xa657926c2180c5ef8469dd3c09e585fb2471f2f9', mfgId: 'SCOT' },
  { address: '0xe324e9320c42f4F55dE0B1eF3F5A60029023430E', mfgId: 'FIL' },
  { address: '0xaFD78041be4b82dFC4535A5cf68187C46d5A1042', mfgId: 'LANC' },
  { address: '0x6BA7277836aFACC81fE92Eaa87472f9D18ffBc30', mfgId: 'JULI' },
  { address: '0x3c5D3f0eF2a48379a80b934bfDAe3f7e14Da7d6f', mfgId: 'BRED' },
  { address: '0x283597a44cFcBb78D02b734c744Ee8d56010E13B', mfgId: 'JACK' },
  { address: '0xd2b26461d769169c7b408b25cf96b23311aa3386', mfgId: 'HENR' }
]

function loadNetworkParticipants(chain, accounts, isIRNAdmin, isMFG, isIRNNode, gasPriceGwei) {
  var c = getAtonomiContract(chain)

  for (var i = 0; i < accounts.length; i++) {
    var account = accounts[i]
    var gasPriceWei = web3.toWei(gasPriceGwei, 'gwei')
    console.log('gas price', gasPriceWei)

    var exists = c.network.call(account.address)
    if (!exists[0] && !exists[1] && !exists[2] && exists[3] === '0x0000000000000000000000000000000000000000000000000000000000000000') {  
      var gas = c.addNetworkMember.estimateGas(account.address, isIRNAdmin, isMFG, isIRNNode, account.mfgId, {from: ETHER_ADDR})
      console.log('gas estimate', gas)
      var h = c.addNetworkMember(account.address, isIRNAdmin, isMFG, isIRNNode, account.mfgId, {from: ETHER_ADDR, gas: gas, gasPrice: gasPriceWei})
      console.log(account.mfgId + ' added to network:', h)
    } else {
      console.log(account.address, 'already whitelisted')
      console.log()
    }

    var score = c.defaultManufacturerReputations.call(account.mfgId)
    if(score === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      var defaultReputation = '6767-1-1'
      var gas = c.setDefaultReputationForManufacturer.estimateGas(account.mfgId, defaultReputation, {from: ETHER_ADDR})
      console.log('gas estimate', gas)
      h = c.setDefaultReputationForManufacturer(account.mfgId, defaultReputation, {from: ETHER_ADDR, gas: gas, gasPrice: gasPriceWei})
      console.log('rep is set:', h)
      console.log()
    } else {
      console.log(account.mfgId, 'reputation already set')
      console.log()
    }
  }
}

function grantTokens(chain, ethAccount) {
  var t = getATMIContract(chain)
  var h = t.transfer(ethAccount, 100 * multiplier, {from: ETHER_ADDR})
  console.log('Transfer 100 ATMI to', ethAccount, h)
}

function getAtonomiState(chain) {
  var c = getSettingsContract(chain)

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