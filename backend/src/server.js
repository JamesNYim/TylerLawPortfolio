// Server.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require ('axios');
const { google } = require('googleapis');
const fs = require('fs');
const crypto = require('crypto'); // FIX: needed for OAuth `state` CSRF protection

// ───────────────────────────────────────────────────────────────────────────────
// Config: prefer envs; keep your existing defaults as fallbacks
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000; 
const OAUTH_URL = process.env.GOOGLE_REDIRECT_URI;
const TOKEN_JSON = process.env.TOKEN_JSON || './token.json'; // optional

const app = express();
app.use(express.json());

// FIX: correct option name `saveUninitialized` and pull secret from env
app.use(session({ 
    secret: process.env.SESSION_SECRET || 'dev_only_secret_key', // FIX: use env; default for local only
    resave: false, 
    saveUninitialized: false // FIX: typo: was `saveUninitalized`
}));

// Load the OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    OAUTH_URL
);

// Load saved token (if it exists)
if (fs.existsSync(TOKEN_JSON)) {
    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_JSON)));
}

// Ensure we are authenticated
function ensureAuth(req, res, next) {
    // FIX: don't rely on possibly-stale access_token; check if we have refresh_token or can refresh.
    const creds = oauth2Client.credentials;
    if (!creds || (!creds.access_token && !creds.refresh_token)) {
        return res.redirect('/auth/google');
    }
    next();
}

// Start OAuth process
app.get('/auth/google', (req, res) => {
    // FIX: add CSRF protection with `state`
    const state = crypto.randomUUID();
    req.session.oauthState = state;

    // FIX: broaden scopes if you want /albums and /api/album/:id to work
    // Keep Picker read-only scope; add Photos Library read-only for album listing.
    const scopes = [
        'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
        //'https://www.googleapis.com/auth/photoslibrary.readonly' // FIX: needed for /albums and /api/album/:albumId
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state // FIX: include state
    });

    console.log('[OAUTH] Using redirect_uri =', process.env.GOOGLE_REDIRECT_URI);
    console.log('[OAUTH] Full auth URL:', authUrl); // visually confirm redirect_uri=<exact value>
    res.redirect(authUrl);
});

// OAuth Callback storing tokens and redirecting
app.get('/auth/google/callback', async (req, res) => {
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

// Create a new Picker Session
app.post('/picker/sessions', ensureAuth, async (req, res) => {
    try {
        // FIX: always fetch a fresh access token right before the API call
        const { token } = await oauth2Client.getAccessToken();
        const { data } = await axios.post(
            'https://photospicker.googleapis.com/v1/sessions',
            {}, // No body unless we restrict to an album
            { headers: { Authorization: `Bearer ${token}`} }
        );

        // FIX: normalize the sessionId (Google returns `name: "sessions/<id>"`)
        const sessionId = (data.name || '').split('/').pop();
        return res.json({
            sessionId, // FIX: expose normalized id
            pickerUri: data.pickerUri, // what you open in a new tab
            raw: data
        });
    }
    catch (error) {
        console.error('sessions.create failed: ', error.response?.data);
        return res.status(500).json({error: 'Could not create Picker session' });
    }
});

// Poll a picker session's status
app.get('/picker/sessions/:sessionId', ensureAuth, async (req, res) => {
    const sessionId = req.params.sessionId;
    // FIX: just logging — add missing slash for readability
    console.log(`=> GET /picker/sessions/${sessionId}`);

    try {
        // FIX: consistently use getAccessToken() to ensure freshness
        const { token } = await oauth2Client.getAccessToken();
        console.log('=> Using access token (truncated): ', token?.slice(0,12), '...');

        if (!token) {
            console.log('X No token Available');
            return res.status(401).json({ error: 'No access token available' });
        }
        const url = `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`; // FIX: encode id
        const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}`}});
        console.log('=> sessions.get succeeded: ', data);
        return res.json(data);
    }
    catch (error) {
        console.error('X sessions.get failed: body = ', error.response?.data);
        console.error('X sessions.get failed: status = ', error.response?.status);
        return res
            .status(error.response?.status || 500)
            .json(error.response?.data || { error: error.message });
    }
});

// Fetch picked items (with pagination)
app.get('/picker/mediaItems', ensureAuth, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  try {
    // FIX: ensure fresh token each call
    const { token } = await oauth2Client.getAccessToken();

    // FIX: paginate until all items are returned
    let items = [];
    let pageToken = null;
    do {
      const { data } = await axios.get(
        'https://photospicker.googleapis.com/v1/mediaItems',
        { 
          headers: { Authorization: `Bearer ${token}` },
          params: { sessionId, pageToken }
        }
      );
      items = items.concat(data.mediaItems || []);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return res.json(items);
  } catch (err) {
    console.error('mediaItems.list failed:', err.response?.data);
    return res.status(500).json({ error: 'Could not list media items' });
  }
});

// Temp Frontend
app.get('/picker', ensureAuth, (req, res) => {
  // FIX: Open Picker in a new tab/window so this page can keep polling
  // FIX: Use `sessionId` property (normalized) instead of `id`
  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Google Photos Picker</title></head>
    <body>
      <button id="start">Pick from Google Photos</button>
      <pre id="output"></pre>
      <script>
        document.getElementById('start').onclick = async () => {
          // 1) Create session
          const sess = await fetch('/picker/sessions', { method: 'POST' })
                             .then(r => r.json());
          
          // 2) Open the Picker UI in a NEW TAB so this page keeps running and can poll
          window.open(sess.pickerUri, '_blank'); // FIX: don't navigate away

          // 3) Poll until they finish picking
          const poll = async () => {
            const info = await fetch('/picker/sessions/' + encodeURIComponent(sess.sessionId))
                                .then(r => r.json());
            if (!info.mediaItemsSet) {
              const interval = info.recommendedPollingIntervalMillis || 1000;
              setTimeout(poll, interval);
            } else {
              // 4) Fetch the chosen items (with pagination handled server-side)
              const items = await fetch('/picker/mediaItems?sessionId=' + encodeURIComponent(sess.sessionId))
                                  .then(r => r.json());
              document.getElementById('output').textContent =
                JSON.stringify(items, null, 2);
            }
          };
          poll();
        };
      </script>
    </body></html>
  `);
});

// List Albums
app.get('/albums', ensureAuth, async (req, res) => {
    // FIX: fetch a fresh token before calling Library API
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
        return res.redirect('/auth/google');
    }

    try {
        const { data } = await axios.get(
            'https://photoslibrary.googleapis.com/v1/albums',
            { headers: { Authorization: `Bearer ${token}` }}
        );
        const albums = data.albums || [];
        return res.send(`
          <h1>Your Google Photos Albums</h1>
          <ul>
            ${albums
              .map(
                (a) =>
                  `<li>
                     <strong>${a.title}</strong><br/>
                     ID: <code>${a.id}</code><br/>
                     <a href="/api/album/${a.id}">View photos in this album</a>
                   </li>`
              )
              .join('')}
          </ul>
        `);
    }
    catch (error) {
        console.error('Album List Failed', error);
        return res.status(500).send(`<pre>${JSON.stringify(error.response?.data, null, 2)}</pre>`);
    }

});

// Get Media from Album
app.get('/api/album/:albumId', ensureAuth, async (req, res) => {
  const albumId = req.params.albumId;

  try {
    // FIX: fetch a fresh token before calling Library API
    const { token } = await oauth2Client.getAccessToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data } = await axios.post(
      'https://photoslibrary.googleapis.com/v1/mediaItems:search',
      { albumId, pageSize: 100 },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.json(data.mediaItems || []);
  } catch (err) {
    console.error('MediaItems.search failed:', err.response?.status, err.response?.data);
    return res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message });
  }
});

// (Optional) helper left as-is: fetch albums using a provided token (not used directly now)
async function getAlbums(accessToken) {
    try {
        const response = await axios.get(
            'https://photoslibrary.googleapis.com/v1/albums',
            {
                headers : {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        return response.data.albums || [];
    }
    catch (error) {
        console.error('Status: ', error.response?.status);
        console.error('Body: ', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} ...`));
