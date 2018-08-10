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
function initBlockstack(context) {
    console.assert(context.secrets.BLOCKSTACK, "missing BLOCKSTACK");
    console.assert(context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG, "missing BLOCKSTACK_GAIA_HUB_CONFIG");
    console.assert(context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY, "missing BLOCKSTACK_TRANSIT_PRIVATE_KEY");
    console.assert(context.secrets.BLOCKSTACK_APP_PRIVATE_KEY, "missing BLOCKSTACK_APP_PRIVATE_KEY");
    process.env.BLOCKSTACK_APP_PRIVATE_KEY = context.secrets.BLOCKSTACK_APP_PRIVATE_KEY;
    process.env.BLOCKSTACK = context.secrets.BLOCKSTACK;
    process.env.BLOCKSTACK_GAIA_HUB_CONFIG = context.secrets.BLOCKSTACK_GAIA_HUB_CONFIG;
    process.env.BLOCKSTACK_TRANSIT_PRIVATE_KEY = context.secrets.BLOCKSTACK_TRANSIT_PRIVATE_KEY;
    loadBlockstack();
}
async function handleSubmission(encryptedData, privateKey) {
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
app.post('/', async (req, res) => {
    console.debug(typeof req.body === 'object', req.body ? req.body.data : req.body);
    if (typeof req.body === 'object' && req.body.data) {
        initBlockstack(req.webtaskContext);
        const encryptedString = req.body.data;
        console.log("cipher text");
        console.log(encryptedString);
        if (!encryptedString || !encryptedString) {
            return res.status(400).send('missing data');
        }
        let jsonSubmission;
        try {
            const privateKey = process.env.BLOCKSTACK_APP_PRIVATE_KEY;
            console.assert(privateKey, "Should BLOCKSTACK_APP_PRIVATE_KEY private key in process.env");
            jsonSubmission = blockstack.decryptContent(encryptedString, { privateKey });
        }
        catch (e) {
            console.error(e);
            return res.status(500).send("decryption failed");
        }
        let submission;
        try {
            submission = JSON.parse(jsonSubmission);
        }
        catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
        await dappform_forms_api_1.newFormSubmission(submission);
        const settings = await write_1.getFile('settings.json');
        if (settings && settings.webhookUrl) {
            await simpleWebhook(settings.webhookUrl, submission);
        }
        res.sendStatus(202);
    }
    else {
        res.status(400).send('no data submitted');
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