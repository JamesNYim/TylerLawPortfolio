// Server.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require ('axios');
const { google } = require('googleapis');
const fs = require('fs');
const crypto = require('crypto'); // FIX: needed for OAuth `state` CSRF protection
const { Pool } = require('pg');

// ───────────────────────────────────────────────────────────────────────────────
// Config: prefer envs; keep your existing defaults as fallbacks
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT; 
const OAUTH_URL = process.env.GOOGLE_REDIRECT_URI;
const TOKEN_JSON = process.env.TOKEN_JSON || './token.json'; // optional

const app = express();

// -----------------------|
// Database Initalization |
// -----------------------|
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureSchema() {
    const ddl = `
         -- Create a table to represent each gallery section (e.g., “weddings”, “travel-2025”)
        CREATE TABLE IF NOT EXISTS sections (             -- create only if missing (safe to run on boot)
          id SERIAL PRIMARY KEY,                          -- surrogate key; handy for admin tools/sorting
          slug TEXT UNIQUE NOT NULL,                      -- URL-friendly identifier (“weddings”); used in API paths and FKs
          title TEXT NOT NULL,                            -- human-friendly name to render on the site
          sort_order INT DEFAULT 0,                       -- lets you order sections in the UI without renaming slugs
          updated_at TIMESTAMPTZ NOT NULL                 -- last time we changed anything in the section (for cache busting/UI refresh)
        );

        -- Create a table for individual photos/videos you imported from the Picker
        CREATE TABLE IF NOT EXISTS media_items (
          id SERIAL PRIMARY KEY,                          -- internal row id (not the Google id)
          google_id TEXT NOT NULL,                        -- stable ID from Google Picker; used to avoid duplicates
          section_slug TEXT NOT NULL                      -- which section this item belongs to…
            REFERENCES sections(slug) ON DELETE CASCADE,  -- …FK to sections.slug; delete media automatically if the section is removed
          filename TEXT NOT NULL,                         -- file name you saved (e.g., IMG_1234.jpg)
          mime_type TEXT,                                 -- image/jpeg, image/png, video/mp4, etc. (useful for player/processing)
          width INT,                                      -- pixels; good for responsive layouts/aspect ratio placeholders
          height INT,                                     -- pixels; same as above
          created_time TIMESTAMPTZ,                       -- original capture time from EXIF/metadata if available
          storage_url TEXT NOT NULL,                      -- the URL your frontend will <img src> (e.g., /static/weddings/IMG_1234.jpg or S3 URL)
          picked_at TIMESTAMPTZ NOT NULL,                 -- when the owner imported it (useful for sorting newest-first)
          UNIQUE (google_id, section_slug)                -- prevents re-importing the same Google item into the same section twice
        );

        -- Speed up queries that fetch items for a given section (your most common query)
        CREATE INDEX IF NOT EXISTS idx_media_items_section ON media_items(section_slug);
        `;
    await pool.query(ddl);
}

ensureSchema().catch((e) => {
    console.error('Failed to ensure database schema', e);
    process.exit(1);
});

// --------------------|
// Static Media Storage|
// --------------------|
const path = require('path');
const MEDIA_DIR = path.resolve(__dirname, '../media');

if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, {recursive: true});
}
app.use('/static', express.static(MEDIA_DIR));


(async () => {
  try {
    const client = await pool.connect();
    const { rows } = await client.query('select version() as v, current_database() as db;');
    console.log('[DB] Connected:', rows[0].v, 'DB=', rows[0].db);
    client.release();
  } catch (e) {
    console.error('[DB] Connection failed:', e.message);
    process.exit(1); // fail fast if DB is unreachable
  }
})();


// -------|
// Routes |
// -------|
app.use(express.json());

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
    const { token } = await oauth2Client.getAccessToken();

    // paginate until all items are returned
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

// Importing picked photos into the database
// Import picked media into a gallery "section"
app.post('/api/gallery/sections/:slug/import', ensureAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const { sessionId, sectionTitle } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    // Upsert the section
    await pool.query(
      `INSERT INTO sections (slug, title, sort_order, updated_at)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             updated_at = EXCLUDED.updated_at`,
      [slug, sectionTitle || slug, new Date().toISOString()]
    );

    const { token } = await oauth2Client.getAccessToken();

    // Fetch all picked items
    const all = [];
    let pageToken = null;
    do {
      const { data } = await axios.get(
        'https://photospicker.googleapis.com/v1/mediaItems',
        { headers: { Authorization: `Bearer ${token}` }, params: { sessionId, pageToken } }
      );
      (data.mediaItems || []).forEach((m) => all.push(m));
      pageToken = data.nextPageToken;
    } while (pageToken);

    const sectionDir = path.join(MEDIA_DIR, slug);
    if (!fs.existsSync(sectionDir)) fs.mkdirSync(sectionDir, { recursive: true });

    const imported = [];
    for (const item of all) {
      const googleId = item.id || item.mediaItemId || item.name?.split('/').pop();
      if (!googleId) continue;

      const filename = item.mediaFile.filename || `${googleId}.jpg`;
      const outPath = path.join(sectionDir, filename);
      const downloadUrl = item.mediaFile.baseUrl;
      if (!downloadUrl) continue;

      const resp = await axios.get(downloadUrl, {
        responseType: 'stream',
        headers: { Authorization: `Bearer ${token}` }
      });
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(outPath);
        resp.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
      });

      const storageUrl = `/static/${slug}/${filename}`;
      await pool.query(
        `INSERT INTO media_items
           (google_id, section_slug, filename, mime_type, width, height, created_time, storage_url, picked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (google_id, section_slug) DO NOTHING`,
        [
          googleId, slug, filename, item.mimeType || null,
          Number(item.mediaMetadata?.width) || null,
          Number(item.mediaMetadata?.height) || null,
          item.mediaMetadata?.creationTime || null,
          storageUrl,
          new Date().toISOString()
        ]
      );

      imported.push({ googleId, storageUrl });
    }

    res.json({ section: slug, importedCount: imported.length, items: imported });
  } catch (err) {
    console.error('Import failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

// Public gallery payload for the frontend 
app.get('/api/gallery', async (req, res) => {
  try {
    // read sections (ordered for display)
    const { rows: sections } = await pool.query(
      `SELECT slug, title, sort_order, updated_at
       FROM sections
       ORDER BY sort_order ASC, slug ASC`
    );

    // fetch items per section
    const out = [];
    for (const s of sections) {
      const { rows: items } = await pool.query(
        `SELECT google_id, filename, mime_type, width, height, created_time, storage_url, picked_at
         FROM media_items
         WHERE section_slug = $1
         ORDER BY picked_at DESC`,
        [s.slug]
      );

      out.push({
        sectionSlug: s.slug,
        sectionTitle: s.title,
        lastUpdatedAt: s.updated_at,
        items: items.map((m) => ({
          id: m.google_id,
          src: m.storage_url,    // this maps to /static/... served by express.static
          width: m.width,
          height: m.height,
          alt: m.filename
        }))
      });
    }

    res.json(out);
  } catch (e) {
    console.error('GET /api/gallery failed:', e);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

// -= DEBUG ROUTES =-
app.get('/_debug/db', async (req, res) => {
  try {
    const { rows: t1 } = await pool.query(`
      select table_name from information_schema.tables 
      where table_schema='public' and table_name in ('sections','media_items') 
      order by table_name;
    `);
    const { rows: c1 } = await pool.query('select count(*)::int as n from sections;');
    const { rows: c2 } = await pool.query('select count(*)::int as n from media_items;');
    res.json({
      tables: t1.map(r => r.table_name),
      counts: { sections: c1[0].n, media_items: c2[0].n }
    });
  } catch (e) {
    console.error('[DB] /_debug/db failed', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} ...`));
