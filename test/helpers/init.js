export function getTestActorsContext (accounts) {
  return {
    owner: accounts[0],
    alice: accounts[1],
    bob: accounts[2],
    releaseAgent: accounts[3]
  }
}

export async function getAtonomiTokenContract (owner, releaseAgent) {
  const AtonomiToken = artifacts.require('AMLToken')
  const tokenName = 'Atonomi Token'
  const tokenSymbol = 'ATMI'
  const tokenDecimals = 18
  const multiplier = 10 ** tokenDecimals
  const initalSupply = 1000000000 * multiplier
  const mintable = false
  const c = await AtonomiToken.new(tokenName, tokenSymbol, initalSupply, tokenDecimals, mintable, {from: owner})

  await c.setReleaseAgent(releaseAgent, {from: owner})
  await c.releaseTokenTransfer({from: releaseAgent})
  return c
}
