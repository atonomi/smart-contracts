#!/bin/bash
#set -e
#set -o pipefail

parity  --geth --jsonrpc-apis "eth,net,parity,parity_pubsub,pubsub,rpc,shh,shh_pubsub,traces,web3" \
        --jsonrpc-port 8545 --jsonrpc-interface local --jsonrpc-cors=none \
        --bootnodes "enode://94c15d1b9e2fe7ce56e458b9a3b672ef11894ddedd0c6f247e0f1d3487f52b66208fb4aeb8179fce6e3a749ea93ed147c37976d67af557508d199d9594c35f09@192.81.208.223:30303,enode://20c9ad97c081d63397d7b685a412227a40e23c8bdc6688c6f37e97cfbc22d2b4d1db1510d8f61e6a8866ad7f0e17c02b14182d37ea7c3c8b9c2683aeb6b733a1@52.169.14.227:30303,enode://6ce05930c72abc632c58e2e4324f7c7ea478cec0ed4fa2528982cf34483094e9cbc9216e7aa349691242576d552a2a56aaeae426c5303ded677ce455ba1acd9d@13.84.180.240:30303" \
        --force-ui \
        >log/parity.log 2>log/parity.err.log