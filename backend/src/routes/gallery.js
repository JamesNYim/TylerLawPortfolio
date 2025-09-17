// gallery.js

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const ensureAuth = require('../middleware/ensureAuth');
const oauth2Client = require('../oauth/google');
const pool = require('../db/pool');

const router = express.Router();

const MEDIA_DIR = path.resolve(__dirname, '../../media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

router.post('/api/gallery/sections/:slug/import', ensureAuth, async (req, res) => {
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

router.get('/api/gallery', async (req, res) => {
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

module.exports = router;
