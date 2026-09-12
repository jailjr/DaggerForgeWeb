const path = require('path');
const { Pool } = require('pg');
const { runMigrations, schemaStatus } = require('./migrations');

function createPostgresStore() {
  if (!process.env.DATABASE_URL) return null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, max: 10 });
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const iso = value => value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();

  async function migrate() { return runMigrations(pool, migrationsDir); }

  async function hydrate(fallback) {
    const [campaignRows, participantRows, characterRows, eventRows, sessionRows] = await Promise.all([
      pool.query('select * from campaigns'),
      pool.query('select * from participants'),
      pool.query('select * from characters'),
      pool.query('select * from audit_events order by created_at desc'),
      pool.query('select * from auth_sessions where expires_at > now()'),
    ]);
    if (!campaignRows.rows.length) return fallback;
    const state = { campaigns: {}, participants: {}, events: [], sessions: {} };
    campaignRows.rows.forEach(row => {
      const metadata = row.metadata || {};
      state.campaigns[row.id] = { id: row.id, name: row.name, mode: row.mode, joinEnabled: row.join_enabled, gmTokenHash: row.gm_token_hash, playerTokenHash: row.player_token_hash, createdAt: iso(row.created_at), ...(row.archived_at ? { archivedAt: iso(row.archived_at) } : {}), ...metadata, characters: {} };
    });
    participantRows.rows.forEach(row => {
      state.participants[row.id] = { id: row.id, campaignId: row.campaign_id, nickname: row.nickname, tokenHash: row.access_token_hash, characterId: row.character_id, revoked: Boolean(row.revoked_at), ...(row.revoked_at ? { revokedAt: iso(row.revoked_at) } : {}), createdAt: iso(row.created_at) };
    });
    characterRows.rows.forEach(row => {
      const campaign = state.campaigns[row.campaign_id];
      if (!campaign) return;
      campaign.characters[row.id] = { id: row.id, ...(row.configuration || {}), ...(row.runtime || {}), ownerId: row.owner_id, privateNotes: row.private_notes || '', version: row.version, ...(row.archived_at ? { archivedAt: iso(row.archived_at) } : {}), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
    });
    state.events = eventRows.rows.map(row => ({ id: row.id, campaignId: row.campaign_id, actorId: row.actor_id, actorRole: row.actor_role, actorLabel: row.nickname_snapshot || row.actor_role, nicknameSnapshot: row.nickname_snapshot || row.actor_role, sessionId: row.session_id || null, summary: row.summary || null, operation: row.operation, entityType: row.entity_type, entityId: row.entity_id, field: row.field, previousValue: row.previous_value, newValue: row.new_value, createdAt: iso(row.created_at) }));
    sessionRows.rows.forEach(row => { state.sessions[row.id_hash] = { campaignId: row.campaign_id, actorId: row.actor_id, role: row.role, expiresAt: new Date(row.expires_at).getTime() }; });
    return state;
  }

  async function persist(state) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const campaigns = Object.values(state.campaigns); const campaignIds = campaigns.map(campaign => campaign.id);
      for (const campaign of campaigns) {
        const metadata = { announcements: campaign.announcements || [], sessions: campaign.sessions || [], encounters: campaign.encounters || [], encounterTemplates: campaign.encounterTemplates || [], gmLibrary: campaign.gmLibrary || {}, presence: campaign.presence || {} };
        await client.query(`insert into campaigns (id,name,mode,join_enabled,gm_token_hash,player_token_hash,metadata,created_at,archived_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do update set name=excluded.name,mode=excluded.mode,join_enabled=excluded.join_enabled,gm_token_hash=excluded.gm_token_hash,player_token_hash=excluded.player_token_hash,metadata=excluded.metadata,archived_at=excluded.archived_at`, [campaign.id, campaign.name, campaign.mode, campaign.joinEnabled !== false, campaign.gmTokenHash, campaign.playerTokenHash, metadata, campaign.createdAt || new Date().toISOString(), campaign.archivedAt || null]);
      }
      await client.query(campaignIds.length ? 'delete from campaigns where not (id = any($1::uuid[]))' : 'delete from campaigns', campaignIds.length ? [campaignIds] : []);
      for (const participant of Object.values(state.participants)) await client.query(`insert into participants (id,campaign_id,nickname,access_token_hash,character_id,revoked_at,created_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do update set nickname=excluded.nickname,access_token_hash=excluded.access_token_hash,character_id=excluded.character_id,revoked_at=excluded.revoked_at`, [participant.id, participant.campaignId, participant.nickname, participant.tokenHash, participant.characterId || null, participant.revokedAt || (participant.revoked ? new Date().toISOString() : null), participant.createdAt || new Date().toISOString()]);
      if (campaignIds.length) await client.query('delete from participants where not (campaign_id = any($1::uuid[]))', [campaignIds]); else await client.query('delete from participants');
      const characterIds = [];
      for (const campaign of campaigns) for (const character of Object.values(campaign.characters || {})) {
        characterIds.push(character.id);
        const runtime = {}; ['hp', 'hope', 'stress', 'armor', 'complete', 'avatarUrl'].forEach(key => { if (character[key] !== undefined) runtime[key] = character[key]; });
        const configuration = { ...character }; ['id', 'ownerId', 'hp', 'hope', 'stress', 'armor', 'complete', 'avatarUrl', 'privateNotes', 'version', 'createdAt', 'updatedAt'].forEach(key => delete configuration[key]);
        await client.query(`insert into characters (id,campaign_id,owner_id,name,configuration,runtime,private_notes,version,archived_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,now()),coalesce($11,now())) on conflict (id) do update set owner_id=excluded.owner_id,name=excluded.name,configuration=excluded.configuration,runtime=excluded.runtime,private_notes=excluded.private_notes,version=excluded.version,archived_at=excluded.archived_at,updated_at=now()`, [character.id, campaign.id, character.ownerId || null, character.name, configuration, runtime, character.privateNotes || '', character.version || 1, character.archivedAt || null, character.createdAt || null, character.updatedAt || null]);
      }
      if (characterIds.length) await client.query('delete from characters where not (id = any($1::uuid[]))', [characterIds]); else await client.query('delete from characters');
      await client.query('delete from audit_events');
      for (const event of (state.events || []).slice(0, 10000)) await client.query('insert into audit_events (id,campaign_id,actor_id,actor_role,nickname_snapshot,operation,entity_type,entity_id,field,previous_value,new_value,session_id,summary,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (id) do nothing', [event.id, event.campaignId, event.actorId || null, event.actorRole || 'SYSTEM', event.nicknameSnapshot || event.actorLabel || null, event.operation, event.entityType, event.entityId, event.field || null, event.previousValue || null, event.newValue || null, event.sessionId || null, event.summary || null, event.createdAt || new Date().toISOString()]);
      await client.query('delete from auth_sessions');
      for (const [sessionId, session] of Object.entries(state.sessions || {})) await client.query('insert into auth_sessions (id_hash,campaign_id,actor_id,role,expires_at) values ($1,$2,$3,$4,to_timestamp($5 / 1000.0))', [sessionId, session.campaignId, session.actorId, session.role, session.expiresAt]);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  }

  async function consumeRateLimit(bucketKey, max, windowMs) { const result = await pool.query(`insert into rate_limit_buckets (bucket_key,window_started,hit_count) values ($1,now(),1) on conflict (bucket_key) do update set hit_count=case when extract(epoch from (now()-rate_limit_buckets.window_started))*1000 >= $2 then 1 else rate_limit_buckets.hit_count+1 end, window_started=case when extract(epoch from (now()-rate_limit_buckets.window_started))*1000 >= $2 then now() else rate_limit_buckets.window_started end returning hit_count`, [bucketKey, windowMs]); return result.rows[0].hit_count > max; }
  return { migrate, hydrate, persist, consumeRateLimit, async health() { const ping = await pool.query('select 1 as ok'); const schema = await schemaStatus(pool, migrationsDir); return { ok: ping.rows[0].ok === 1 && schema.ok, provider: 'postgres-normalized', schema }; }, close: () => pool.end() };
}

module.exports = { createPostgresStore };
