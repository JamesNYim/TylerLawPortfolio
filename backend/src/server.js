// Server.js

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const sessionMiddleware = require('./middleware/session');
const ensureAuth = require('./middleware/ensureAuth');

const pool = require ('./db/pool');
const ensureSchema = require('./db/ensureSchema');

const oauthRoutes = require('./routes/oauth');
const pickerRoutes = require('./routes/picker');
const galleryRoutes = require('./routes/gallery');
const albumsRoutes = require('./routes/albums');

const app = express();

// JSON + Session
app.use(express.json());
app.use(sessionMiddleware);

// Ensure Schema
// Static Media Storage|
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
ensureSchema().catch((e) => {
    console.error('Failed to ensure database schema', e);
    process.exit(1);
});

// Temp admin page
app.get('/picker', ensureAuth, (req, res) => {
    res.sendFile(path.resolve(__dirname, './static/picker.html'));
});

// Routes
app.use(oauthRoutes);
app.use(pickerRoutes);
app.use(galleryRoutes);
app.use(albumsRoutes);

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

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} ...`));
