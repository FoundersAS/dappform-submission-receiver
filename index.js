const loadBlockstack = require('blockstack-anywhere')
const blockstack = require('blockstack')

module.exports = function (context, cb) {
  process.env.BLOCKSTACK = context.secrets.BLOCKSTACK
  process.env.BLOCKSTACK_GAIA_HUB_CONFIG = context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG
  process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY = context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY

  loadBlockstack()

  blockstack.getFile('forms.json').then(data => {
    console.log(data)
    cb(null, JSON.parse(data))
  }).catch(cb)
}
