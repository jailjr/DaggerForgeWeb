import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { migrationFiles, runMigrations } from './migrations.js';

const directory = path.join(process.cwd(), 'migrations');

describe('Postgres migration runner', () => {
  it('loads ordered migrations with stable checksums', () => {
    const files = migrationFiles(directory);
    expect(files.map(file => file.version)).toEqual([1, 2, 3]);
    expect(files.every(file => /^[a-f0-9]{64}$/.test(file.checksum))).toBe(true);
    expect(files[0].name).toBe('001_initial.sql');
  });

  it('applies each migration once and rejects checksum drift', async () => {
    const history: Array<{ version: number; name: string; checksum: string }> = [];
    const executed: string[] = [];
    const pool: any = {
      query: async (sql: string) => {
        if (sql.startsWith('select version')) return { rows: history };
        if (sql.startsWith('create table if not exists schema_migrations')) return { rows: [] };
        return { rows: [] };
      },
      connect: async () => ({ query: async (sql: string, params?: any[]) => {
        if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] };
        if (sql.startsWith('insert into schema_migrations')) { history.push({ version: params[0], name: params[1], checksum: params[2] }); return { rows: [] }; }
        executed.push(sql);
        return { rows: [] };
      }, release: () => {} }),
    };
    const first = await runMigrations(pool, directory);
    expect(first.latest).toBe(3);
    expect(executed).toHaveLength(3);
    expect(await runMigrations(pool, directory)).toEqual({ applied: 3, latest: 3 });
    expect(executed).toHaveLength(3);
    history[0].checksum = '0'.repeat(64);
    await expect(runMigrations(pool, directory)).rejects.toThrow(/Migration drift detected/);
  });

  it('keeps legacy upgrade additive and aligned with runtime columns', () => {
    const sql = fs.readFileSync(path.join(directory, '002_upgrade_legacy_schema.sql'), 'utf8');
    expect(sql).toContain('add column if not exists metadata');
    expect(sql).toContain('add column if not exists nickname_snapshot');
    expect(sql).toContain('add column if not exists session_id');
    expect(sql.toLowerCase()).not.toContain('drop table');
    expect(sql.toLowerCase()).not.toContain('delete from');
  });
});
