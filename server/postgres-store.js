const { Pool } = require('pg');

function createPostgresStore() {
  if (!process.env.DATABASE_URL) return null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, max: 5 });
  return {
    async migrate() { await pool.query('create table if not exists daggerforge_state (id integer primary key check (id = 1), payload jsonb not null, updated_at timestamptz not null default now())'); },
    async hydrate(fallback) { const result = await pool.query('select payload from daggerforge_state where id = 1'); return result.rows[0]?.payload || fallback; },
    async persist(state) { await pool.query('insert into daggerforge_state (id, payload, updated_at) values (1, $1::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at', [JSON.stringify(state)]); },
    async close() { await pool.end(); }
  };
}
module.exports = { createPostgresStore };
