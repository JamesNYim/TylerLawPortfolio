// ensureAuth.js

function ensureAuth(req, res, next) {
    const creds = oauth2Client.credentials;
    if (!creds || (!creds.access_token && !creds.refresh_token)) {
        return res.redirect('/auth/google');
    }
    next();
}

module.exports = ensureAuth;
