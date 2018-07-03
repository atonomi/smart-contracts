#!/bin/bash
#set -e
#set -o pipefail

npm config set tmp=/var/lib/jenkins/tmp
npm install
npm run lint
npm run lint:sol
npm run test
