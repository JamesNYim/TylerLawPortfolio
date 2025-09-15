// oauth.js
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { OAUTH_URL, TOKEN_JSON } = require('../config');
const oauth2Client = require('../oauth/google');

const router = express.Router();

router.get('/auth/google', (req, res) => {
    // FIX: add CSRF protection with `state`
    const state = crypto.randomUUID();
    req.session.oauthState = state;

    /*
    const scopes = [
        'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
        //'https://www.googleapis.com/auth/photoslibrary.readonly' // FIX: needed for /albums and /api/album/:albumId
    ];
    */

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: process.env.GOOGLE_SCOPES.split(' '),
        state 
    });

    console.log('[OAUTH] Using redirect_uri =', process.env.GOOGLE_REDIRECT_URI);
    console.log('[OAUTH] Full auth URL:', authUrl); // visually confirm redirect_uri=<exact value>
    res.redirect(authUrl);
});

router.get('/auth/google/callback', async (req, res) => {
    try { 
        // FIX: verify the `state` to prevent CSRF
        if (!req.query.state || req.query.state !== req.session.oauthState) {
            return res.status(400).send('<pre>Invalid OAuth state</pre>');
        }

        const { tokens } = await oauth2Client.getToken(req.query.code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_JSON, JSON.stringify(tokens, null, 2));
        return res.redirect('/picker');
    } 
    catch (error) { 
        console.error('CALLBACK ERROR:', error); 
        return res.status(500).send(`<pre>${error.message}</pre>`); 
    } 
});

module.exports = router;
