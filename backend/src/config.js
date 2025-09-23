// config.js
// Enviroment and Constants

require('dotenv').config();
const path = require('path');
const fs = require('fs');
// ───────────────────────────────────────────────────────────────────────────────
// Config: prefer envs; keep your existing defaults as fallbacks
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT; 
const OAUTH_URL = process.env.GOOGLE_REDIRECT_URI;
const TOKEN_JSON = process.env.TOKEN_JSON || './token.json'; // optional

const MEDIA_DIR = path.resolve(__dirname, '../media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

module.exports = {
    PORT,
    OAUTH_URL,
    TOKEN_JSON,
    MEDIA_DIR
};
