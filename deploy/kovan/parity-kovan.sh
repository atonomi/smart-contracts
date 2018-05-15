#!/bin/bash
#set -e
#set -o pipefail

if [ -z ${DATA_DIR+x} ]; then DATA_DIR=/atonomi/demochain; fi
echo -e "DATA_DIR is set to '$DATA_DIR'"

parity --chain kovan  --geth --jsonrpc-apis "eth,net,parity,parity_pubsub,pubsub,rpc,shh,shh_pubsub,traces,web3" --jsonrpc-port 8545 --jsonrpc-interface local --jsonrpc-cors=none --no-warp
