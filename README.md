# Atonomi Ethereum Smart Contracts

### Ropsten Contracts

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | [0x32050f78221d61f8b7641aa11eca0a76d8a0954f](https://ropsten.etherscan.io/address/0x32050f78221d61f8b7641aa11eca0a76d8a0954f#code)  |
| ATMI Token (TokenMarket)  | [0x728913b826b12b38e647880e9cf852161790afdb](https://ropsten.etherscan.io/address/0x728913b826b12b38e647880e9cf852161790afdb)  |


### Setup

Downlaod and install the latest version of Solidity here: https://solidity.readthedocs.io/en/v0.4.22/installing-solidity.html (use Homebrew)
Download and install the latest LTS version of Node.js here: https://nodejs.org/en/

Also have `truffle` and `ganache-cli` installed globally

```
$ npm install -g truffle
$ npm install -g ganache-cli
```

Then run: 

```
$ npm install
```

### Compile

To re-compile contracts and build artifacts:

```
$ npm run compile
```

### Linting

To validate linters for JS and SOL files:

```
$ npm run lint
$ npm run lint:sol
```

### Deploy to local Ganache

To deploy contracts to a local Ganche RPC provider at port `8546`:

```
$ npm run ganache-cli
$ npm run deploy
```

### Deploy to Atonomi Ropsten test node

Make sure you have the latest version of `geth` installed: https://github.com/ethereum/go-ethereum/wiki/Installing-Geth
Then change into the deploy directory:

```
$ cd deploy
```

Then attach to the Atonomi Ropsten Test node (this is internal to Atonomi Network)
If you need Ropsten Test Ether, go here: http://faucet.ropsten.be:3001/ or https://faucet.metamask.io/

```
$ export PARITY_NODE=http://test.parity.atonomi.io:8545
$ export ETHER_ADDR=0xe9a3f9d5e08bce9a8bbe8d00fcc4c1c30019f678
$ export SAFEMATHLIB_ADDR=0x32050f78221d61f8b7641aa11eca0a76d8a0954f
$ export ATMI_ADDR=0x728913b826b12b38e647880e9cf852161790afdb
$ ./geth-attach.sh
```

This will drop you into a geth console that will have preloaded the Atonomi constants and abi needed for contract deployment.

To deploy the mock ATMI token contract

```
> loadScript('scripts/deploy-atmi-token.js')
```

### Unit Tests

To execute the full unit test truffle suite: 

```
$ npm test
```

### Unit Test Coverage Report

To execute the full unit test truffle suite and generate test coverage report:

```
$ npm run test:coverage
```
