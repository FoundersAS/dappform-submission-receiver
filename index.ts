import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import { newFormSubmission, Submission } from 'dappform-forms-api'
import * as express from 'express'

const wt = require('webtask-tools')

const loadBlockstack = require('blockstack-anywhere')
const blockstack = require('blockstack')
const privateKey = process.env.BLOCKSTACK_APP_PRIVATE_KEY

function initBlockstack(context: any) {
  process.env.BLOCKSTACK = context.secrets.BLOCKSTACK
  process.env.BLOCKSTACK_GAIA_HUB_CONFIG = context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG
  process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY = context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY
  loadBlockstack()
}

async function handleSubmission(publicKey: string, encryptedData: string) {
  return await newFormSubmission(JSON.parse(blockstack.decryptContent(encryptedData, { privateKey })) as Submission)
}

const app = express()

app.use(cors())
app.use(bodyParser.json())

// Post to a bench must provide public key + data blob
app.post('/', (req: any, res) => {
  if (typeof req.body === 'object' && req.body.data && req.body.key) {
    initBlockstack(req.webtaskContext)

    const key = req.body.key
    const encryptedDataString = JSON.stringify(req.body.data)

    handleSubmission(key, encryptedDataString).then((d) => {
      return res.send(d)
    })
  } else {
    res.status(500).send('no data submitted')
  }
})

module.exports = wt.fromExpress(app)
