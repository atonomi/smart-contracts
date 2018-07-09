# Atonomi Ethereum Smart Contracts

<img src="audit/EmblemB.png" alt="Hosho Audited" height="125px"/>

### MainNet Chain

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | [0x850493fd6f7a92f6d462ccba9e438b76b000bcc1](https://etherscan.io/address/0x850493fd6f7a92f6d462ccba9e438b76b000bcc1) |
| ATMI Token (TokenMarket)  | [0x97aeb5066e1a590e868b511457beb6fe99d329f5](https://etherscan.io/address/0x97aeb5066e1a590e868b511457beb6fe99d329f5) |
| Network Settings | Coming Soon |
| Atonomi | Coming Soon |

### Kovan Chain

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | [0x5ef8b987e8c733d957a70441d3a086bccd1f78a9](https://kovan.etherscan.io/address/0x5ef8b987e8c733d957a70441d3a086bccd1f78a9) |
| ATMI Token (TokenMarket)  | [0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7](https://kovan.etherscan.io/address/0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7) |
| Network Settings | [0x729a741ce0c776130c50d35906f0dbd248184982](https://kovan.etherscan.io/address/0x729a741ce0c776130c50d35906f0dbd248184982) |
| Atonomi | [0xbde8f51601e552d620c208049c5970f7b52cd044](https://kovan.etherscan.io/address/0xbde8f51601e552d620c208049c5970f7b52cd044) |


### Setup

Download and install the latest version of Solidity here: https://solidity.readthedocs.io/en/v0.4.22/installing-solidity.html (use Homebrew)

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
$ cd deploy
$ export PARITY_NODE=http://localhost:8545
$ export ETHER_ADDR=0xfb0987013cc730d33e537bb0ce61298ab8eb2553
$ ./geth-attach.sh
```

This will drop you into a geth console that will have preloaded the Atonomi constants and abi needed for contract deployment.  Replace ETHER_ADDR with your own account.

To deploy the Atonomi contracts run the following:
```
> hash = initSafeMathLib()
> hash = initATMIToken("address of safemathlib", false)
> hash = initNetworkSettings(false)
> hash = initAtonomi("address of erc token", "address of network settings contract", false)
> receipt = getTransactionReceipt('txn hash')  // use this to ping if the transaction has been confirmed
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

View the current test coverage report [here](https://htmlpreview.github.io/?https://raw.githubusercontent.com/atonomi/smart-contracts/master/coverage/contracts/Atonomi.sol.html)
