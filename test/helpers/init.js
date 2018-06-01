export function getTestActorsContext (accounts) {
  return {
    owner: accounts[0],
    alice: accounts[1],
    bob: accounts[2],
    releaseAgent: accounts[3],
    admin: accounts[4],
    mfg: accounts[5],
    irnNode: accounts[6],
    deviceOwner: accounts[7],
    repAuditor: accounts[8]
  }
}

const tokenDecimals = 18
const multiplier = 10 ** tokenDecimals

export async function getAtonomiTokenContract (owner, releaseAgent) {
  const AtonomiToken = artifacts.require('AMLToken')
  const tokenName = 'Atonomi Token'
  const tokenSymbol = 'ATMI'
  const initalSupply = 1000000000 * multiplier
  const mintable = false
  const c = await AtonomiToken.new(tokenName, tokenSymbol, initalSupply, tokenDecimals, mintable, {from: owner})

  await c.setReleaseAgent(releaseAgent, {from: owner})
  await c.releaseTokenTransfer({from: releaseAgent})
  return c
}

export async function getAtonomiContract (owner, tokenAddr) {
  const Atonomi = artifacts.require('Atonomi')
  const NetworkSettings = artifacts.require('NetworkSettings')

  const regFee = 1 * multiplier
  const actFee = 1 * multiplier
  const repReward = 1 * multiplier
  const reputationShare = 20
  const blockThreshold = 5760 // assuming 15s blocks, 1 write per day
  const r = await NetworkSettings.new(
    regFee, actFee,
    repReward,
    reputationShare,
    blockThreshold, {from: owner})

  const c = await Atonomi.new(
    tokenAddr,
    r.address,
    {from: owner})

  return c
}
