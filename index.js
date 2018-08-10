"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bodyParser = require("body-parser");
const cors = require("cors");
const dappform_forms_api_1 = require("dappform-forms-api");
const express = require("express");
const write_1 = require("dappform-forms-api/dist/lib/write");
const request = require("request");
const wt = require('webtask-tools');
const loadBlockstack = require('blockstack-anywhere');
const blockstack = require('blockstack');
console.assert(process.env.BLOCKSTACK_APP_PRIVATE_KEY, "missing process.env.BLOCKSTACK_APP_PRIVATE_KEY");
const privateKey = process.env.BLOCKSTACK_APP_PRIVATE_KEY;
function initBlockstack(context) {
    console.assert(context.secrets.BLOCKSTACK, "missing BLOCKSTACK");
    console.assert(context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG, "missing BLOCKSTACK_GAIA_HUB_CONFIG");
    console.assert(context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY, "missing BLOCKSTACK_TRANSIT_PRIVATE_KEY");
    process.env.BLOCKSTACK = context.secrets.BLOCKSTACK;
    process.env.BLOCKSTACK_GAIA_HUB_CONFIG = context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG;
    process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY = context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY;
    loadBlockstack();
}
async function handleSubmission(publicKey, encryptedData) {
    const submission = JSON.parse(blockstack.decryptContent(encryptedData, { privateKey }));
    await dappform_forms_api_1.newFormSubmission(submission);
    const settings = await write_1.getFile('settings.json');
    if (settings && settings.webhookUrl) {
        await simpleWebhook(settings.webhookUrl, submission);
    }
}
const app = express();
app.use(cors());
app.use(bodyParser.json());
// Post to a bench must provide public key + data blob
app.post('/', (req, res) => {
    if (typeof req.body === 'object' && req.body.data && req.body.key) {
        initBlockstack(req.webtaskContext);
        const key = req.body.key;
        const encryptedDataString = JSON.stringify(req.body.data);
        handleSubmission(key, encryptedDataString)
            .then(() => res.end());
    }
    else {
        res.status(500).send('no data submitted');
    }
});
async function simpleWebhook(url, submission) {
    request(url, {
        json: submission
    }, (error, response, body) => {
        if (error || response.statusCode > 299) {
            console.error("Failed sending webhook: ", error);
        }
        else {
            console.log("Did call webhook. Status: ", response.statusCode);
        }
    });
}
module.exports = wt.fromExpress(app);
// app.listen(3000, ()=> {
//   simpleWebhook("http://localhost:3000",{"data": {}})
// })
//# sourceMappingURL=index.js.map