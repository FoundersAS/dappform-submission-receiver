import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import { Answer, getFile, newFormSubmission, Submission } from 'dappform-forms-api'
import * as express from 'express'
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

const app = express()

app.use(cors())
app.use(bodyParser.json({limit: '5mb'}))

app.get('/version', (req:any, res) => res.send(req.webtaskContext.secrets.version || "0.0.0"))

app.post('/', async (req: any, res) => {
  console.log(typeof req.body === 'object', req.body ? req.body.data : req.body)
  if (typeof req.body === 'object' && req.body.data) {
    initBlockstack(req.webtaskContext)

    const encryptedString:string = req.body.data
    // console.log("cipher text")
    // console.log(encryptedString)
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

    console.log("Decrypted submission:")
    console.log(JSON.stringify(submission.answers[0],null,2))

    const dataUrlRegex = /^data:.+\/(.+);base64,(.*)$/

    // handle file uploads
    const fileBuffers = submission.answers
      .filter(a => dataUrlRegex.test(a.value))
      .map(a => {
        const [matches, ext, data] = a.value.match(dataUrlRegex)
        const buf = new Buffer(data, 'base64');
        return <[string, Buffer, Answer]>[`files/${submission.formUuid}/${submission.uuid}-${a.questionUuid}.${ext}`, buf, a]
      })

    const filesPromises = fileBuffers
      .map(([path, buf, answer]) => [blockstack.putFile(path, buf), answer])
      .map(([promise, answer]) => promise.then((path:string) => {
          answer.value = path
          return path
        }))

    const filesPromisesRes = await Promise.all(filesPromises)
    if (filesPromisesRes.length > 0) {
      console.log("Wrote ", filesPromisesRes)
    }

    await newFormSubmission(submission)

    console.log("Wrote ",JSON.stringify(submission, null, 2))

    try {
      const settings:any = await getFile('settings.json')
      if (settings && settings.webhookUrl) {
        simpleWebhook( settings.webhookUrl, submission)
      }
    }
    catch (e) {
      console.error("Failed web hook")
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
  // simpleWebhook("http://localhost:3000",{"data": {}})
  // console.debug('listening on 3000')
// })