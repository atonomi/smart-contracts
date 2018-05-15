#!/bin/bash
#set -e
#set -o pipefail

parity --chain kovan  --geth --jsonrpc-apis "eth,net,parity,parity_pubsub,pubsub,rpc,shh,shh_pubsub,traces,web3" --jsonrpc-port 8545 --jsonrpc-interface local --jsonrpc-cors=none --no-warp
