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
const regFee = 1 * multiplier
const actFee = 1 * multiplier
const repReward = 1 * multiplier
const repShare = 20
const blockThreshold = 5760

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

export async function getNetworkSettingsContract (app, owner, storage) {
  const NetworkSettings = artifacts.require('NetworkSettings')

  return app.createProxy(NetworkSettings, 'NetworkSettings', 'initialize', [
    owner,
    regFee, actFee,
    repReward, repShare, blockThreshold, storage]
  )
}

export async function getNetworkMemberContract (app, owner, storage) {
  const NetworkMemberManager = artifacts.require('NetworkMemberManager')
  return app.createProxy(NetworkMemberManager, 'NetworkMemberManager', 'initialize', [
    owner,
    storage]
  )
}

export async function getReputationManagerContract (app, owner, storage, token) {
  const ReputationManager = artifacts.require('ReputationManager')
  return app.createProxy(ReputationManager, 'ReputationManager', 'initialize', [
    owner,
    storage,
    token]
  )
}

export async function getTokenPoolContract (app, storage) {
  const TokenPool = artifacts.require('TokenPool')
  return app.createProxy(TokenPool, 'TokenPool', 'initialize', [
    storage
  ])
}

export async function getStorageContract (owner) {
  const EternalStorage = artifacts.require('EternalStorage')
  return EternalStorage.new({from: owner})
}

export async function getDevicesContract (app, owner, storage, token, settings) {
  const DeviceManager = artifacts.require('DeviceManager')
  return app.createProxy(DeviceManager, 'DeviceManager', 'initialize', [
    owner,
    storage,
    token,
    settings]
  )
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
