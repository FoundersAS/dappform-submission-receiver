import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import { newFormSubmission, Submission } from 'dappform-forms-api'
import * as express from 'express'
import { getFile } from 'dappform-forms-api/dist/lib/write'
import request = require('request')

const wt = require('webtask-tools')

const loadBlockstack = require('blockstack-anywhere')
const blockstack = require('blockstack')

function initBlockstack(context: any) {
  console.assert(context.secrets.BLOCKSTACK, "missing BLOCKSTACK")
  console.assert(context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG, "missing BLOCKSTACK_GAIA_HUB_CONFIG")
  console.assert(context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY, "missing BLOCKSTACK_TRANSIT_PRIVATE_KEY")
  console.assert(context.secrets.BLOCKSTACK_APP_PRIVATE_KEY, "missing BLOCKSTACK_APP_PRIVATE_KEY")

  process.env.BLOCKSTACK_APP_PRIVATE_KEY = context.secrets.BLOCKSTACK_APP_PRIVATE_KEY
  process.env.BLOCKSTACK = context.secrets.BLOCKSTACK
  process.env.BLOCKSTACK_GAIA_HUB_CONFIG = context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG
  process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY = context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY
  loadBlockstack()
}

async function handleSubmission(encryptedData: string, privateKey:string) {

  const submission = JSON.parse(blockstack.decryptContent(encryptedData, { privateKey })) as Submission
  await newFormSubmission(submission)

  const settings:any = await getFile('settings.json')
  if (settings && settings.webhookUrl) {
    await simpleWebhook( settings.webhookUrl, submission)
  }
}

const app = express()

app.use(cors())
app.use(bodyParser.json())

// Post to a bench must provide public key + data blob
app.post('/', async (req: any, res) => {
  if (typeof req.body === 'object' && req.body.data && req.body.key) {
    initBlockstack(req.webtaskContext)

    const encryptedObject:Object = req.body.data
    console.log("cipher text")
    console.log(encryptedObject)
    if (!encryptedObject) {
      return res.status(400).send('missing .data')
    }

    let jsonSubmission:string
    try {
      const privateKey = process.env.BLOCKSTACK_APP_PRIVATE_KEY
      console.assert(privateKey, "Should BLOCKSTACK_APP_PRIVATE_KEY private key in process.env")
      jsonSubmission = blockstack.decryptContent(encryptedObject, { privateKey })
    }
    catch (e) {
      console.error(e)
      return res.status(500).send("decryption failed")
    }

    let submission:Submission
    try {
      submission = JSON.parse(jsonSubmission) as Submission
    }
    catch (e) {
      console.error(e)
      return res.sendStatus(500)
    }

    await newFormSubmission(submission)

    const settings:any = await getFile('settings.json')
    if (settings && settings.webhookUrl) {
      await simpleWebhook( settings.webhookUrl, submission)
    }
    res.sendStatus(202)
  }
  else {
    res.status(400).send('no data submitted')
  }
})

async function simpleWebhook (url:string, submission:Object) {
  request(url,{
    json: submission
  }, (error, response, body) => {
    if (error || response.statusCode > 299) {
      console.error("Failed sending webhook: ",error)
    }
    else {
      console.log("Did call webhook. Status: ", response.statusCode)
    }
  })
}

module.exports = wt.fromExpress(app)
// app.listen(3000, ()=> {
//   simpleWebhook("http://localhost:3000",{"data": {}})
// })