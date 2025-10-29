import fs from 'fs';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`
});

const rows = JSON.parse(fs.readFileSync(new URL('../sections.json', import.meta.url)));

const UPSERT = `
  INSERT INTO sections (slug, title, sort_order)
  VALUES ($1,$2,$3)
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        sort_order = EXCLUDED.sort_order
`;

const main = async () => {
  for (const r of rows) {
    await pool.query(UPSERT, [r.slug, r.title, r.sort_order ?? null]);
  }
  console.log('Seeded sections:', rows.map(r=>r.slug).join(', '));
  await pool.end();
};
main().catch(e => { console.error(e); process.exit(1); });

