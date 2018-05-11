#!/bin/bash
#set -e
#set -o pipefail

/usr/bin/parity  --geth --jsonrpc-apis "eth,net,parity,parity_pubsub,pubsub,rpc,shh,shh_pubsub,traces,web3" --jsonrpc-port 8545 --jsonrpc-interface local --jsonrpc-cors=none --reserved-peers /home/fil/atonomi/smart-contracts/deploy/ropsten-peers.txt --force-ui

