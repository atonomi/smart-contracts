# Atonomi Ethereum Smart Contracts

### Private Dev Chain

<img src="hosho.png" alt="Hosho audit in process" height="125px"/>

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | 0x1e07783a9ef2648a4e99b3e9a9cc0440a978dbeb |
| ATMI Token (TokenMarket)  | 0xc84d2d4d20cba70c00ada9da9d9940983ae4e9b9 |
| Atonomi | 0xb46d9f080f704595ff44fad7a676eb9202faa951 |

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
```

### Deploy to local ganache-cli

To deploy contracts to a local Ganche RPC provider at port `8546`:

```
$ npm run ganache-cli
$ npm run deploy
```

### Start a private dev chain node

```
$ export DATA_DIR=/atonomi/demochain
$ ./parity-dev.sh
```

### Deploy to private dev chain

Make sure you have the latest version of `geth` installed: https://github.com/ethereum/go-ethereum/wiki/Installing-Geth

Then change into the deploy directory:

```
$ cd deploy
$ export PARITY_NODE=http://ropsten.atonomi.io:8545
$ export ETHER_ADDR=0xfb0987013cc730d33e537bb0ce61298ab8eb2553
$ ./geth-attach.sh
```

This will drop you into a geth console that will have preloaded the Atonomi constants and abi needed for contract deployment.  Replace ETHER_ADDR with your own account.

To deploy the Atonomi contracts run the following:
```
> initSafeMathLib()
> initATMIToken("address of safemathlib")
> initAtonomi("address of erc token")
> waitForTransactionReceipt('txn hash')  // use this to ping if the transaction has been confirmed
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
