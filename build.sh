#!/bin/bash
#set -e
#set -o pipefail

mkdir /var/lib/jenkins/tmp/smart-contracts
npm config set tmp=/var/lib/jenkins/tmp/smart-contracts
npm install
npm run lint
npm run lint:sol
npm run test
rm -rf /var/lib/jenkins/tmp/smart-contracts
