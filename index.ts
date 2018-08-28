import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import { newFormSubmission, Submission } from 'dappform-forms-api'
import * as express from 'express'
import { getFile, putFile } from 'dappform-forms-api/dist/lib/write'
import request = require('request')
import { Request, Response } from 'express'


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

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.get('/version', (req:any, res) => res.send(req.webtaskContext.secrets.version || "0.0.0"))

app.post('/', async (req: any, res) => {
  console.log(typeof req.body === 'object', req.body ? req.body.data : req.body)
  if (typeof req.body === 'object' && req.body.data) {
    initBlockstack(req.webtaskContext)

    const encryptedString:string = req.body.data
    console.log("cipher text")
    console.log(encryptedString)
    if (!encryptedString || !encryptedString) {
      return res.status(400).send('missing data')
    }

    let jsonSubmission:string
    try {
      const privateKey = process.env.BLOCKSTACK_APP_PRIVATE_KEY
      console.assert(privateKey, "Should BLOCKSTACK_APP_PRIVATE_KEY private key in process.env")
      jsonSubmission = blockstack.decryptContent(encryptedString, { privateKey })
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

interface WtReq extends Request {
  webtaskContext: Object
}

app.get('/view/:formId', async (req: WtReq, res:Response) => {
  const formId = req.params.formId
  console.assert(formId, "Didn't find form id")
  initBlockstack(req.webtaskContext)

  const statsFile = `views/${formId}.json`
  type FormStats = {
    numViews: number
  }
  let viewsObj:FormStats = await getFile(statsFile) as any

  if (!viewsObj) {
    viewsObj = <FormStats>{
      numViews: 0,
    }
  }
  if (typeof viewsObj.numViews !== 'number') {
    viewsObj.numViews = 0
  }

  viewsObj.numViews += 1
  await putFile(statsFile, viewsObj, false)
  console.log("wrote "+statsFile, viewsObj)

  res.sendStatus(202)
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
  // simpleWebhook("http://localhost:3000",{"data": {}})
  // console.debug('listening on 3000')
// })