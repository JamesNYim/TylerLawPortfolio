// Server.js

const sessionMiddleware = require('./middleware/session');
const ensureAuth = require('./middleware/ensureAuth');
const oauth2Client = require('./oauth/google');
const pool = require ('./db/pool');
const ensureSchema = require('./db/ensureSchema');

const oauthRoutes = require('./routes/oauth');
const pickerRoutes = require('./routes/picker');
const galleryRoutes = require('./routes/gallery');
const albumsRoutes = require('./routes/albums');

const express = require('express');
const session = require('express-session');
const fs = require('fs');

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

// app.use(session())

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
    res.sendFile(path.join(__dirname, '../static/picker.html'));
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
