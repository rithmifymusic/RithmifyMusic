// Deletes ALL accounts, friends and shared playlists. Run once on the server:
//   DATABASE_URL=... node wipe-accounts.js --yes
const { Pool } = require('pg');

if (!process.env.DATABASE_URL || process.argv[2] !== '--yes') {
  console.error('Uporaba: DATABASE_URL=... node wipe-accounts.js --yes');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
});
(async () => {
  for (const t of ['collabs', 'friend_links', 'accounts']) {
    try { const r = await pool.query(`DELETE FROM ${t}`); console.log(t, 'izbrisano:', r.rowCount); } catch (e) { console.log(t, 'preskočeno:', e.message); }
  }
  await pool.end();
})();
