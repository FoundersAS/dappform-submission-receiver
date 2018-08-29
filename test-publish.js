require('load-environment')
const fs = require('fs')
const request = require('request')
const p = require('./package.json')

console.assert(process.env.BLOCKSTACK, "missing BLOCKSTACK")
console.assert(process.env.BLOCKSTACK_GAIA_HUB_CONFIG, "missing BLOCKSTACK_GAIA_HUB_CONFIG")
console.assert(process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY, "missing BLOCKSTACK_TRANSIT_PRIVATE_KEY")
console.assert(process.env.BLOCKSTACK_APP_PRIVATE_KEY, "missing BLOCKSTACK_APP_PRIVATE_KEY")
console.assert(process.env.WEBTASK_ID, "missing WEBTASK_ID")
console.assert(process.env.WEBTASK_TOKEN, "missing WEBTASK_TOKEN")

const webtaskAPI = `https://sandbox.auth0-extend.com/api/webtask/${process.env.WEBTASK_ID}`

const name = 'dappform-tasks-submission'

request({
  url: `${webtaskAPI}/${name}?key=${process.env.WEBTASK_TOKEN}`,
  method: 'PUT',
  json: {
    code: fs.readFileSync('index.js').toString(),
    secrets: {
      version: p.version,
      BLOCKSTACK: process.env.BLOCKSTACK,
      BLOCKSTACK_GAIA_HUB_CONFIG: process.env.BLOCKSTACK_GAIA_HUB_CONFIG,
      BLOCKSTACK_TRANSIT_PRIVATE_KEY: process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY,
      BLOCKSTACK_APP_PRIVATE_KEY: process.env.BLOCKSTACK_APP_PRIVATE_KEY
    },
    meta: {
      'wt-node-dependencies': JSON.stringify(p.dependencies).replace(/\^/g, '')
    }
  }
}, (err, res, body) => {
  console.log(err, body)
})
