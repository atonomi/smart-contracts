#!/bin/bash
#set -e
#set -o pipefail

if [ -z ${PARITY_NODE+x} ]; then PARITY_NODE=http://localhost:8545; fi
echo -e "PARITY_NODE is set to '$PARITY_NODE'"

if [ -z ${ETHER_ADDR+x} ]; then ETHER_ADDR=0x48015f23eb79791050885f9464e6dea7456df60b; fi
echo -e "ETHER_ADDR is set to '$ETHER_ADDR'"

if [ -z ${SAFEMATHLIB_ADDR+x} ]; then SAFEMATHLIB_ADDR=0x5ef8b987e8c733d957a70441d3a086bccd1f78a9; fi
echo -e "SAFEMATHLIB_ADDR is set to '$SAFEMATHLIB_ADDR'"

if [ -z ${ATMI_ADDR+x} ]; then ATMI_ADDR=0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7; fi
echo -e "ATMI_ADDR is set to '$ATMI_ADDR'"

npm run compile

echo -e "" > scripts/atonomi-consts.js
echo -e "var ETHER_ADDR='$ETHER_ADDR'" >> scripts/atonomi-consts.js
echo -e "var SAFEMATHLIB_ADDR='$SAFEMATHLIB_ADDR'" >> scripts/atonomi-consts.js
echo -e "var ATMI_ADDR='$ATMI_ADDR'" >> scripts/atonomi-consts.js

echo -e "" > scripts/atonomi-abis.js
echo -e "var SafeMathLibJSON = " >> scripts/atonomi-abis.js | cat "../build/contracts/SafeMathLib.json" >> scripts/atonomi-abis.js
echo -e "\nvar AtonomiTokenJSON = " >> scripts/atonomi-abis.js | cat "../build/contracts/AMLToken.json" >> scripts/atonomi-abis.js
echo -e "\nvar AtonomiJSON = " >> scripts/atonomi-abis.js | cat "../build/contracts/Atonomi.json" >> scripts/atonomi-abis.js

geth --preload "scripts/atonomi-consts.js,scripts/deploy-helpers.js,scripts/atonomi-abis.js,scripts/deploy-atonomi.js" attach $PARITY_NODE
