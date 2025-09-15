// config.js
// Enviroment and Constants

require('dotenv').config();
// ───────────────────────────────────────────────────────────────────────────────
// Config: prefer envs; keep your existing defaults as fallbacks
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT; 
const OAUTH_URL = process.env.GOOGLE_REDIRECT_URI;
const TOKEN_JSON = process.env.TOKEN_JSON || './token.json'; // optional

module.exports = {
    PORT,
    OAUTH_URL,
    TOKEN_JSON
};
