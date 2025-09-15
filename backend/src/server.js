// Server.js

const express = require('express');
const session = require('express-session');
const axios = require ('axios');
const crypto = require('crypto'); // FIX: needed for OAuth `state` CSRF protection


const app = express();

// Ensure Schema
// Static Media Storage|
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
// Load saved token (if it exists)


// Ensure we are authenticated
//ensureAuth


// Start OAuth process
//auth/google

// OAuth Callback storing tokens and redirecting
// auth/google/callback

// Create a new Picker Session
// /picker/sessions

// Poll a picker session's status
// /picker/sessions/:sessionId

// Fetch picked items (with pagination)
// /picker/mediaItems

// Temp Frontend
app.get('/picker', ensureAuth, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Google Photos Picker</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; line-height: 1.4; }
    label { display: block; margin: 12px 0 4px; }
    input, button { font-size: 14px; padding: 8px 10px; }
    #output { white-space: pre-wrap; background:#f6f8fa; padding:12px; border-radius:8px; }
  </style>
</head>
<body>
  <h1>Google Photos Picker (auto-import)</h1>

  <label>Section slug (URL friendly)</label>
  <input id="slug" placeholder="e.g. weddings" value="weddings" />

  <label>Section title (display name)</label>
  <input id="title" placeholder="e.g. Weddings" value="Weddings" />

  <div style="margin:16px 0;">
    <button id="start">Pick from Google Photos</button>
  </div>

  <div id="status"></div>
  <h3>Picked items (preview)</h3>
  <pre id="output"></pre>

  <script>
  const $ = (id) => document.getElementById(id);

  document.getElementById('start').onclick = async () => {
    const slug = $('slug').value.trim() || 'gallery';
    const sectionTitle = $('title').value.trim() || slug;

    $('status').textContent = 'Creating Picker session…';

    // 1) Create session
    const sess = await fetch('/picker/sessions', { method: 'POST' }).then(r => r.json());
    // Expecting { sessionId, pickerUri, ... }
    if (!sess || !sess.sessionId || !sess.pickerUri) {
      $('status').textContent = 'Failed to create Picker session.';
      return;
    }

    // 2) Open the Picker UI in a NEW TAB so this page keeps running and can poll
    window.open(sess.pickerUri, '_blank');

    $('status').textContent = 'Waiting for selection… (you can switch to the Picker tab)';

    let imported = false; // guard so we only import once

    // 3) Poll until they finish picking
    const poll = async () => {
      try {
        const info = await fetch('/picker/sessions/' + encodeURIComponent(sess.sessionId)).then(r => r.json());
        if (!info.mediaItemsSet) {
          const interval = info.recommendedPollingIntervalMillis || 1200;
          setTimeout(poll, interval);
        } else {
          $('status').textContent = 'Selection complete. Fetching chosen items…';

          // 4) Fetch the chosen items (server does pagination)
          const items = await fetch('/picker/mediaItems?sessionId=' + encodeURIComponent(sess.sessionId)).then(r => r.json());
          $('output').textContent = JSON.stringify(items, null, 2);

          // 5) Auto-import ONCE
          if (!imported) {
            imported = true;
            $('status').textContent = 'Importing to section "' + sectionTitle + '"…';

            const resp = await fetch('/api/gallery/sections/' + encodeURIComponent(slug) + '/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sess.sessionId, sectionTitle })
            });
            const data = await resp.json();

            if (resp.ok) {
              $('status').textContent = 'Imported ' + (data.importedCount || 0) + ' items. You can now render /api/gallery on the frontend.';
            } else {
              $('status').textContent = 'Import failed: ' + (data.error || resp.statusText);
            }
          }
        }
      } catch (e) {
        $('status').textContent = 'Polling error: ' + (e?.message || e);
      }
    };
    poll();
  };
  </script>
</body>
</html>
  `);
});

// List Albums
// /albums

// Get Media from Album
// /api/album/:albumId

// Importing picked photos into the database
// Import picked media into a gallery "section"
// /api/gallery/sections/:slug/import

// Public gallery payload for the frontend 
// /api/gallery
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
