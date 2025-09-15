// google.js
// oauth2client creation
// usage: const oauth2Client = require('../oauth/google');

const { google } = require('googleapis');
const fs = require('fs');
const { OAUTH_URL, TOKEN_JSON } = require('../config');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    OAUTH_URL
);

if (fs.existsSync(TOKEN_JSON)) {
    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_JSON)));
}

module.exports = oauth2Client;


