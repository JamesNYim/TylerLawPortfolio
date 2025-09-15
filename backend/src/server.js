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
