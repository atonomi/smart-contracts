var tokenName = 'Atonomi Token'
var tokenSymbol = 'ATMI'
var tokenDecimals = 18
var multiplier = Math.pow(10, tokenDecimals)
var regFee = 0.25 * multiplier
var actFee = 0.25 * multiplier
var repReward = 0.125 * multiplier
var reputationShare = 20
var blockThreshold = 5760 // assuming 15s blocks, 1 write per day
var initalSupply = 1000000000 * multiplier

var chains = {
  mainnet: {
    token: '0x97aeb5066e1a590e868b511457beb6fe99d329f5',
    atonomi: undefined,
    settings: undefined
  },
  kovan: {
    token: '0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7',
    atonomi: '0xbde8f51601e552d620c208049c5970f7b52cd044',
    settings: '0x729a741ce0c776130c50d35906f0dbd248184982'
  },
  ganache: {
    token: AtonomiTokenJSON.networks[5777] ? AtonomiTokenJSON.networks[5777].address : undefined,
    atonomi: AtonomiTokenJSON.networks[5777] ? AtonomiJSON.networks[5777].address : undefined,
    settings: AtonomiTokenJSON.networks[5777] ? NetworkSettingsJSON.networks[5777].address : undefined
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

function initNetworkSettings(estimateOnly) {
  console.log('Configuring Networking Settings...')
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

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
  console.log('txn hash', hash)
  return hash
}

function initAtonomi(ercAddress, settingsAddress, estimateOnly) {
  console.log('Configuring Atonomi...')
  var constructorByteCode = web3.eth.contract(AtonomiJSON.abi).new.getData(
    ercAddress,
    settingsAddress,
    {data: AtonomiJSON.bytecode})

  // TODO: kovan issue with estimate gas for larger contracts
  // var gas = web3.eth.estimateGas({from: ETHER_ADDR, data: constructorByteCode})
  var gas = 6500000
  console.log('gas estimate', gas)

  if(estimateOnly) return undefined

  var hash = web3.eth.sendTransaction({from: ETHER_ADDR, data: constructorByteCode, gas: gas})
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

function initTestEnv(chain) {
  var c = getAtonomiContract(chain)

  var testAccounts = [
    { address: ETHER_ADDR, mfgId: 'TEST', rep: '6767-1-1' },
    { address: '0x079Df73b5Ce40323020E7064a6De14c1702A8bfD', mfgId: 'LEVK', rep: '6767-1-1' },
    { address: '0xa657926c2180c5ef8469dd3c09e585fb2471f2f9', mfgId: 'SCOT', rep: '6767-1-1' },
    { address: '0xe324e9320c42f4F55dE0B1eF3F5A60029023430E', mfgId: 'FIL', rep: '6767-1-1' },
    { address: '0xaFD78041be4b82dFC4535A5cf68187C46d5A1042', mfgId: 'LANC', rep: '6767-1-1' },
    { address: '0x6BA7277836aFACC81fE92Eaa87472f9D18ffBc30', mfgId: 'JULI', rep: '6767-1-1' }
  ]

  for (var i = 0; i < testAccounts.length; i++) {
    var account = testAccounts[i]
    var h = c.addNetworkMember(account.address, true, true, true, testAccounts.mfgId, {from: ETHER_ADDR})
    console.log(account.mfgId + ' added to network:', h)
    h = c.setDefaultReputationForManufacturer(account.mfgId, account.rep, {from: ETHER_ADDR})
    console.log('rep is set:', h)
    console.log()
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