//Session.js

const session = require('express-session');

module.exports = session({ 
    secret: process.env.SESSION_SECRET || 'dev_only_secret_key', // FIX: use env; default for local only
    resave: false, 
    saveUninitialized: false // FIX: typo: was `saveUninitalized`
});


