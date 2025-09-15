// ensureSchema.js
// Ensures that our database is setup correctly

// -----------------------|
// Database Initalization |
// -----------------------|
const pool = require('./pool');

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

module.exports = ensureSchema;

// Put this in server.js
/*
ensureSchema().catch((e) => {
    console.error('Failed to ensure database schema', e);
    process.exit(1);
});
*/


