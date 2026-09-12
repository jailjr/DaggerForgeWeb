const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function migrationFiles(directory) {
  return fs.readdirSync(directory)
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]))
    .map(name => {
      const version = Number(name.split('_')[0]);
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      return { version, name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

async function runMigrations(pool, directory) {
  const files = migrationFiles(directory);
  await pool.query('create table if not exists schema_migrations (version integer primary key, name varchar(255) not null, checksum char(64) not null, applied_at timestamptz not null default now())');
  const appliedResult = await pool.query('select version, name, checksum from schema_migrations order by version');
  const applied = new Map(appliedResult.rows.map(row => [Number(row.version), row]));
  for (const migration of files) {
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing.name !== migration.name || existing.checksum !== migration.checksum) throw new Error(`Migration drift detected for ${migration.name}.`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(migration.sql);
      await client.query('insert into schema_migrations (version,name,checksum) values ($1,$2,$3)', [migration.version, migration.name, migration.checksum]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw new Error(`Migration ${migration.name} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
  return { applied: files.length, latest: files.length ? files[files.length - 1].version : 0 };
}

async function schemaStatus(pool, directory) {
  const files = migrationFiles(directory);
  const result = await pool.query(`select
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'campaigns') as campaigns,
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'participants') as participants,
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'characters') as characters,
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_events') as audit_events,
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'auth_sessions') as auth_sessions,
    exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'schema_migrations') as schema_migrations,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'campaigns' and column_name = 'metadata') as campaign_metadata,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'nickname_snapshot') as nickname_snapshot`);
  const row = result.rows[0];
  const appliedResult = await pool.query('select coalesce(max(version), 0) as latest, count(*)::int as count from schema_migrations');
  const applied = appliedResult.rows[0];
  const required = ['campaigns', 'participants', 'characters', 'audit_events', 'auth_sessions', 'schema_migrations', 'campaign_metadata', 'nickname_snapshot'];
  const missing = required.filter(key => !row[key]);
  const pending = files.filter(file => !Number(applied.latest) || file.version > Number(applied.latest)).map(file => file.name);
  return { ok: missing.length === 0 && pending.length === 0, latest: Number(applied.latest), expected: files.length ? files[files.length - 1].version : 0, pending, missing };
}

module.exports = { migrationFiles, runMigrations, schemaStatus };
