# Atonomi Ethereum Smart Contracts

### Kovan Chain

<img src="hosho.png" alt="Hosho audit in process" height="125px"/>

| Contract  | Address |
| ------------- | ------------- |
| SafeMathLib (TokenMarket)  | 0x5ef8b987e8c733d957a70441d3a086bccd1f78a9 |
| ATMI Token (TokenMarket)  | 0x38e29b9c172da31696e784efb7c69c9cbf172308 |
| Atonomi | 0x4f2c90249d452e7bf2d0b714d803f74eaa150ca4 |


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
