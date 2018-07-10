// README
//-- This script takes a json collection of accounts, appends a mfgId, and outputs new json and csv files.
//-- To run:
//---- 1. add `input.json` file that you wish to append to at this location
//---- 2. `mkdir output` at this location
//---- 3. cd to this directory and run `node account-parser.js`
//---- 4. on successful run, see output files in `/output` folder
//---- input ex.  `[{ address: '0x1234abcdABCD1234abcdABCD1234abcdABCD1234', email: 'kevDurant@nyk.com' }]`
//---- output ex. `[{ address: '0x1234abcdABCD1234abcdABCD1234abcdABCD1234', email: 'kevDurant@nyk.com', mfgId: 'DMV9' }]`

const fs = require('fs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const input = require('./input.json')
const str = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const myChars = [...str]

let output = []
let recordsForCSV = []
let MfgId = ['D','0','0','0']

input.forEach(account => {
  let digit
  account.mfgId = MfgId.toString().replace(/,/g,'')
  output.push(account)
  recordsForCSV.push({address: account.address, email: account.email, mfgId: account.mfgId})

  // pick last un-maxed digit
  for(let i = 3; i >= 1; i--) {
    if(MfgId[i] == myChars[35]) {
      MfgId[i] = '0' // reset digit value to 0 before moving to next digit
      continue // digit is maxed, so continue
    }
    digit = i
    break
  }

  // set given digit to next highest value
  for(let i = 0; i < myChars.length; i++) {
    if(MfgId[digit] == myChars[i]){ // find current myChars match
      MfgId[digit] = myChars[i+1]  // increment it
      break
    }
  }

})

const csvWriter = createCsvWriter({
  path: 'output/MfgOutput.csv',
  header: [
    {id: 'address', title: 'ADDRESS'},
    {id: 'email', title: 'EMAIL'},
    {id: 'mfgId', title: 'ID'}
  ]
})

// create csv
csvWriter.writeRecords(recordsForCSV)
console.log('csv output file created')

var json = JSON.stringify(output)

// create json
fs.writeFile('output/MfgOutput.json', json, 'utf8', (err => {
    if (err) { return console.log(err) }
    console.log('json output file created')
  })
)
