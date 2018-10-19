# Atonomi Ethereum Smart Contracts

<img src="audit/EmblemB.png" alt="Hosho Audited" height="125px"/>

### MainNet Chain

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | [0x850493fd6f7a92f6d462ccba9e438b76b000bcc1](https://etherscan.io/address/0x850493fd6f7a92f6d462ccba9e438b76b000bcc1) |
| ATMI Token (TokenMarket)  | [0x97aeb5066e1a590e868b511457beb6fe99d329f5](https://etherscan.io/address/0x97aeb5066e1a590e868b511457beb6fe99d329f5) |
| Network Settings | [0x2566c658331eac75d3b3ccd0e45c78d9cf6c4c4c](https://etherscan.io/address/0x2566c658331eac75d3b3ccd0e45c78d9cf6c4c4c) |
| Atonomi | [0x899f3b22908ff5674f8237c321ab309417887606](https://etherscan.io/address/0x899f3b22908ff5674f8237c321ab309417887606) |

### Kovan Chain

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | [0x5ef8b987e8c733d957a70441d3a086bccd1f78a9](https://kovan.etherscan.io/address/0x5ef8b987e8c733d957a70441d3a086bccd1f78a9) |
| ATMI Token (TokenMarket)  | [0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7](https://kovan.etherscan.io/address/0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7) |
| Network Settings | [0x729a741ce0c776130c50d35906f0dbd248184982](https://kovan.etherscan.io/address/0x729a741ce0c776130c50d35906f0dbd248184982) |
| Atonomi | [0xbde8f51601e552d620c208049c5970f7b52cd044](https://kovan.etherscan.io/address/0xbde8f51601e552d620c208049c5970f7b52cd044) |


### Setup

Download and install the latest version of Solidity here: https://solidity.readthedocs.io/en/v0.4.23/installing-solidity.html (use Homebrew)

Download and install the latest LTS version of Node.js here: https://nodejs.org/en/

Also have `zos`, `truffle` and `ganache-cli` installed globally

```
$ npm install --global zos
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
```

### Deploy to local ganache-cli

To deploy contracts to a local Ganche RPC provider at port `8546`:

```
$ npm run ganache-cli
$ npm run deploy
```

### Start a parity node

```
$ cd deploy/kovan
$ ./parity-kovan.sh
```

### Deploy contracts

Make sure you have the latest version of `geth` installed: https://github.com/ethereum/go-ethereum/wiki/Installing-Geth

Then change into the deploy directory:

```
$ zos push --network local    // repeat to upgrade instances
$ deploy/kovan/zos-deploy.sh  // only do once
```

Make sure the network profile you are targeting is configured correctly in `truffle.js`.

### Unit Tests

To execute the full unit test truffle suite: 

```
$ export NODE_ENV=test truffle test
$ npm test
$ TESTFILE=test/filename.test.js npm run test:single
```

### Unit Test Coverage Report

To execute the full unit test truffle suite and generate test coverage report:

```
$ export NODE_ENV=test truffle test
$ npm run test:coverage
```

View the current test coverage report [here](https://htmlpreview.github.io/?https://raw.githubusercontent.com/atonomi/smart-contracts/master/coverage/contracts/Atonomi.sol.html)
