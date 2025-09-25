// gallery.js

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');


const ensureAuth = require('../middleware/ensureAuth');
const oauth2Client = require('../oauth/google');
const pool = require('../db/pool');

const router = express.Router();

const { MEDIA_DIR } = require('../config');

// === helpers (add near top of file, after MEDIA_DIR) ===
function localPathFromStorageUrl(storageUrl) {
  // Expect storageUrl like "/static/<slug>/<filename>"
  if (!storageUrl || !storageUrl.startsWith('/static/')) return null;
  const rel = storageUrl.replace('/static/', ''); // "<slug>/<filename>"
  const abs = path.join(MEDIA_DIR, rel);          // MEDIA_DIR/<slug>/<filename>
  // safety: ensure we're still inside MEDIA_DIR
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(MEDIA_DIR + path.sep)) return null;
  return resolved;
}

// POST picked photos in designated section
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

      let filename = item.mediaFile.filename || `${googleId}.jpg`;
      let outPath = path.join(sectionDir, filename);
      const downloadUrl = item.mediaFile.baseUrl;
      if (!downloadUrl) continue;

      const resp = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}` }
      });

      let buffer = Buffer.from(resp.data);
      
      const ext = path.extname(filename).toLowerCase();
  
      if (ext === '.heic' || ext === '.heif') {
        // Convert to jpg
        const jpgName = filename.replace(/\.(heic|heif)$/i, '.jpg');
        outPath = path.join(sectionDir, jpgName);
  
        buffer = await sharp(buffer, { limitInputPixels: false })
          .jpeg({ quality: 90 })
          .toBuffer();
  
        filename = jpgName; // update stored filename
      }

      await fs.promises.writeFile(outPath, buffer); 
      const storageUrl = `/media/${slug}/${filename}`;
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

// GET all the photos in db
router.get('/api/gallery', async (req, res) => {
  try {
    // read sections (ordered for display)
    const { rows: sections } = await pool.query(
      `SELECT s.slug, s.title, s.sort_order, s.updated_at
       FROM sections s
       WHERE EXISTS (
         SELECT 1 FROM media_items m WHERE m.section_slug = s.slug
       )
       ORDER BY s.sort_order ASC, s.slug ASC`
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
      ); out.push({ sectionSlug: s.slug,
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

// GET photos in a section
router.get('/api/gallery/sections/:slug/items', async (req, res) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         section_slug AS "slug",
         storage_url  AS "fullUrl",
         storage_url  AS "thumbUrl",
         filename,
         mime_type    AS "mimeType",
         width,
         height,
         created_time AS "createdAt",
         google_id    AS "googleId",
         picked_at    AS "pickedAt"
       FROM media_items
       WHERE section_slug = $1
       ORDER BY created_time DESC NULLS LAST, id DESC`,
      [slug]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET section items failed:', e);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

// POST a section bulk delete
router.post('/api/gallery/sections/:slug/delete', async (req, res) => {
  const { slug } = req.params;
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids[] required' });
  }
  const intIds = ids.map(n => Number.parseInt(n, 10)).filter(Number.isFinite);
  if (intIds.length === 0) return res.status(400).json({ error: 'ids[] must be integers' });

  try {
    // 1) Fetch target rows to know which files to remove
    const { rows: victims } = await pool.query(
      `SELECT id, storage_url
       FROM media_items
       WHERE section_slug = $1 AND id = ANY($2::int[])`,
      [slug, intIds]
    );

    // 2) Delete DB rows first (so UI state is authoritative even if file unlink fails)
    const { rowCount } = await pool.query(
      `DELETE FROM media_items
       WHERE section_slug = $1 AND id = ANY($2::int[])`,
      [slug, intIds]
    );

    // 3) Best-effort local file cleanup
    for (const v of victims) {
      const p = localPathFromStorageUrl(v.storage_url);
      if (!p) continue;
      try { await fs.promises.unlink(p); } catch (_) { /* ignore */ }
    }

    res.json({ deletedCount: rowCount });
  } catch (e) {
    console.error('Bulk delete failed:', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

//DELETE a single item
router.delete('/api/gallery/sections/:slug/items/:id', async (req, res) => {
  const { slug, id } = req.params;
  const intId = Number.parseInt(id, 10);
  if (!Number.isFinite(intId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    // fetch row to know which file to remove
    const { rows } = await pool.query(
      `SELECT storage_url
       FROM media_items
       WHERE section_slug = $1 AND id = $2`,
      [slug, intId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // delete row
    await pool.query(
      `DELETE FROM media_items
       WHERE section_slug = $1 AND id = $2`,
      [slug, intId]
    );

    // best-effort file unlink
    const p = localPathFromStorageUrl(rows[0].storage_url);
    if (p) { try { await fs.promises.unlink(p); } catch (_) {} }

    res.status(204).end();
  } catch (e) {
    console.error('Single delete failed:', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
