const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const port = Number(process.env.PORT || 8787);
const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'campaigns.json');
fs.mkdirSync(dataDir, { recursive: true });

function load() {
  if (!fs.existsSync(dbFile)) return { campaigns: {}, participants: {}, events: [] };
  try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { return { campaigns: {}, participants: {}, events: [] }; }
}
let db = load();
function save() { const tmp = `${dbFile}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, dbFile); }
function id() { return crypto.randomUUID(); }
function token() { return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function now() { return new Date().toISOString(); }
function json(res, status, value) { const body = JSON.stringify(value); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) }); res.end(body); }
function error(res, status, message) { json(res, status, { error: message }); }
function readBody(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function bearer(req) { const value = req.headers.authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; }
function findAccess(campaign, raw) { if (!raw) return null; const digest = hash(raw); if (digest === campaign.gmTokenHash) return { role: 'GM', id: 'gm' }; if (digest === campaign.playerTokenHash) return { role: 'JOIN', id: 'join' }; const participant = Object.values(db.participants).find(p => p.campaignId === campaign.id && p.tokenHash === digest && !p.revoked); return participant ? { role: 'PLAYER', id: participant.id } : null; }
const streams = new Map();
const attempts = new Map();
function rateLimited(key) { const current = attempts.get(key) || { count: 0, started: Date.now() }; if (Date.now() - current.started > 60_000) { attempts.set(key, { count: 1, started: Date.now() }); return false; } current.count += 1; attempts.set(key, current); return current.count > 60; }
function publish(campaignId, event) { const listeners = streams.get(campaignId) || []; const line = `data: ${JSON.stringify(event)}\n\n`; listeners.forEach(res => res.write(line)); }
function audit(campaign, actor, operation, entityType, entityId, field, before, after) { const event = { id: id(), campaignId: campaign.id, actorId: actor.id, actorRole: actor.role, operation, entityType, entityId, field, previousValue: before, newValue: after, createdAt: now() }; db.events.unshift(event); publish(campaign.id, event); }
function publicCharacter(c, includePrivate) { const copy = { ...c }; if (!includePrivate) delete copy.privateNotes; return copy; }
function view(campaign, actor) { const chars = Object.values(campaign.characters).map(c => publicCharacter(c, actor.role === 'GM' || c.ownerId === actor.id)); const out = { id: campaign.id, name: campaign.name, mode: campaign.mode, joinEnabled: campaign.joinEnabled, characters: chars }; if (actor.role === 'GM') { out.gmLibrary = campaign.gmLibrary; out.events = db.events.filter(e => e.campaignId === campaign.id).slice(0, 100); } return out; }

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, time: now() });
    if (req.method === 'POST' && url.pathname === '/api/campaigns') {
      const body = await readBody(req); const gmToken = token(); const playerToken = token(); const campaign = { id: id(), name: String(body.name || 'Untitled Campaign').slice(0, 120), mode: 'PREPARATION', joinEnabled: true, gmTokenHash: hash(gmToken), playerTokenHash: hash(playerToken), createdAt: now(), characters: {}, gmLibrary: { adversaries: [], environments: [], items: [], encounters: [] } };
      db.campaigns[campaign.id] = campaign; save(); return json(res, 201, { campaign: { id: campaign.id, name: campaign.name, mode: campaign.mode }, gmToken, playerToken });
    }
    if (req.method === 'POST' && url.pathname === '/api/campaigns/import') {
      const body = await readBody(req); const source = body && body.campaign; if (!source || body.schemaVersion !== 1) return error(res, 400, 'Unsupported export format.');
      const gmToken = token(); const playerToken = token(); const campaign = { id: id(), name: String(source.name || 'Imported Campaign').slice(0, 120), mode: source.mode === 'PLAY' ? 'PLAY' : 'PREPARATION', joinEnabled: source.joinEnabled !== false, gmTokenHash: hash(gmToken), playerTokenHash: hash(playerToken), createdAt: now(), characters: {}, gmLibrary: source.gmLibrary && typeof source.gmLibrary === 'object' ? source.gmLibrary : { adversaries: [], environments: [], items: [], encounters: [] } };
      const sourceCharacters = source.characters && typeof source.characters === 'object' ? source.characters : {};
      Object.values(sourceCharacters).slice(0, 100).forEach(raw => { const character = raw && typeof raw === 'object' ? raw : {}; const characterId = id(); campaign.characters[characterId] = { id: characterId, name: String(character.name || 'Imported Character').slice(0, 120), className: String(character.className || ''), ancestry: String(character.ancestry || ''), color: String(character.color || '#a88be3'), initials: String(character.initials || 'PC').slice(0, 4), hp: Number.isFinite(character.hp) ? character.hp : 0, hpMax: Number.isFinite(character.hpMax) ? character.hpMax : 6, hope: Number.isFinite(character.hope) ? character.hope : 0, stress: Number.isFinite(character.stress) ? character.stress : 0, armor: Number.isFinite(character.armor) ? character.armor : 0, level: Number.isFinite(character.level) ? character.level : 1, complete: character.complete === true, ownerId: null, inventory: Array.isArray(character.inventory) ? character.inventory.slice(0, 50).map(String) : [], privateNotes: '', version: 1 }; });
      db.campaigns[campaign.id] = campaign; save(); return json(res, 201, { campaign: { id: campaign.id, name: campaign.name, mode: campaign.mode }, gmToken, playerToken, importedCharacters: Object.keys(campaign.characters).length });
    }
    if (parts[0] !== 'api' || parts[1] !== 'campaigns' || !parts[2]) return error(res, 404, 'Not found');
    const campaign = db.campaigns[parts[2]]; if (!campaign) return error(res, 404, 'Not found');
    const actor = findAccess(campaign, bearer(req)); if (!actor) return error(res, 401, 'Unauthorized');
    if (req.method === 'GET' && parts.length === 3) return json(res, 200, view(campaign, actor));
    if (req.method === 'GET' && parts[3] === 'events') { if (actor.role !== 'GM') return error(res, 404, 'Not found'); return json(res, 200, { events: db.events.filter(e => e.campaignId === campaign.id).slice(0, 200) }); }
    if (req.method === 'GET' && parts[3] === 'stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`); const list = streams.get(campaign.id) || []; list.push(res); streams.set(campaign.id, list); req.on('close', () => streams.set(campaign.id, (streams.get(campaign.id) || []).filter(x => x !== res))); return;
    }
    if (req.method === 'POST' && parts[3] === 'join') {
      if (actor.role !== 'GM' && actor.role !== 'JOIN') return error(res, 404, 'Not found');
      if (!campaign.joinEnabled) return error(res, 403, 'New player joins are disabled.'); const body = await readBody(req); const participantToken = token(); const participant = { id: id(), campaignId: campaign.id, nickname: String(body.nickname || 'Player').slice(0, 60), tokenHash: hash(participantToken), revoked: false, characterId: null, createdAt: now() }; db.participants[participant.id] = participant; save(); return json(res, 201, { participant: { id: participant.id, nickname: participant.nickname }, participantToken, campaign: view(campaign, { role: 'PLAYER', id: participant.id }) });
    }
    if (req.method === 'POST' && parts[3] === 'mode') { if (actor.role !== 'GM') return error(res, 403, 'GM access required'); const body = await readBody(req); const before = campaign.mode; campaign.mode = body.mode === 'PLAY' ? 'PLAY' : 'PREPARATION'; save(); audit(campaign, actor, 'mode.change', 'campaign', campaign.id, 'mode', before, campaign.mode); save(); return json(res, 200, view(campaign, actor)); }
    if (req.method === 'POST' && parts[3] === 'player-access' && parts[4] === 'regenerate') { if (actor.role !== 'GM') return error(res, 403, 'GM access required'); const newToken = token(); campaign.playerTokenHash = hash(newToken); save(); audit(campaign, actor, 'access.regenerate', 'campaign', campaign.id, 'playerAccess', null, 'regenerated'); save(); return json(res, 200, { playerToken: newToken }); }
    if (req.method === 'POST' && parts[3] === 'participants' && parts[4] && parts[5] === 'revoke') { if (actor.role !== 'GM') return error(res, 403, 'GM access required'); const participant = db.participants[parts[4]]; if (!participant || participant.campaignId !== campaign.id) return error(res, 404, 'Not found'); participant.revoked = true; participant.revokedAt = now(); audit(campaign, actor, 'participant.revoke', 'participant', participant.id, 'revoked', false, true); save(); return json(res, 200, { ok: true }); }
    if (req.method === 'GET' && parts[3] === 'export') { if (actor.role !== 'GM') return error(res, 404, 'Not found'); const exported = JSON.parse(JSON.stringify(campaign)); delete exported.gmTokenHash; delete exported.playerTokenHash; return json(res, 200, { schemaVersion: 1, exportedAt: now(), campaign: exported, participants: Object.values(db.participants).filter(p => p.campaignId === campaign.id).map(p => ({ id: p.id, nickname: p.nickname, characterId: p.characterId, revoked: p.revoked })) }); }
    if (req.method === 'POST' && parts[3] === 'characters' && parts[4] && parts[5] === 'claim') {
      const character = campaign.characters[parts[4]]; if (!character) return error(res, 404, 'Not found'); if (actor.role !== 'GM' && character.ownerId && character.ownerId !== actor.id) return error(res, 409, 'This character is already assigned.'); if (actor.role === 'PLAYER' && character.ownerId === actor.id) return json(res, 200, publicCharacter(character, true)); const before = character.ownerId; character.ownerId = actor.role === 'GM' ? (await readBody(req)).participantId || null : actor.id; character.version += 1; if (actor.role === 'PLAYER') db.participants[actor.id].characterId = character.id; audit(campaign, actor, 'character.claim', 'character', character.id, 'ownerId', before, character.ownerId); save(); return json(res, 200, publicCharacter(character, true));
    }
    if (req.method === 'PATCH' && parts[3] === 'characters' && parts[4]) {
      const character = campaign.characters[parts[4]]; if (!character) return error(res, 404, 'Not found'); if (actor.role === 'PLAYER' && character.ownerId !== actor.id) return error(res, 404, 'Not found'); const body = await readBody(req); if (Number(body.version) !== character.version) return error(res, 409, 'Conflict: character changed elsewhere.'); const allowed = actor.role === 'GM' || campaign.mode === 'PREPARATION' ? ['name','className','ancestry','hp','hpMax','hope','stress','armor','complete','inventory','privateNotes'] : ['hp','hope','stress','inventory']; const changes = {}; for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) changes[key] = body[key]; const before = {}; Object.keys(changes).forEach(k => before[k] = character[k]); Object.assign(character, changes); character.version += 1; audit(campaign, actor, 'character.update', 'character', character.id, 'state', before, changes); save(); return json(res, 200, publicCharacter(character, actor.role === 'GM' || character.ownerId === actor.id));
    }
    return error(res, 404, 'Not found');
  } catch (e) { return error(res, e.message === 'Invalid JSON' ? 400 : 500, e.message === 'Invalid JSON' ? e.message : 'Internal server error'); }
}

function serveStatic(req, res) {
  if (process.env.SERVE_STATIC !== '1' || req.method !== 'GET') return false;
  const requested = new URL(req.url, 'http://localhost').pathname;
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const target = path.resolve(process.cwd(), 'dist', relative);
  const distRoot = path.resolve(process.cwd(), 'dist');
  const safeTarget = target.startsWith(distRoot) ? target : path.join(distRoot, 'index.html');
  const finalTarget = fs.existsSync(safeTarget) && fs.statSync(safeTarget).isFile() ? safeTarget : path.join(distRoot, 'index.html');
  if (!fs.existsSync(finalTarget)) return false;
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'content-type': types[path.extname(finalTarget)] || 'application/octet-stream', 'cache-control': relative === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable' }); res.end(fs.readFileSync(finalTarget)); return true;
}
const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', process.env.CORS_ORIGIN || 'http://127.0.0.1:5173');
  res.setHeader('access-control-allow-headers', 'authorization,content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.end();
  if (rateLimited(req.socket.remoteAddress || 'unknown')) return error(res, 429, 'Too many requests. Try again shortly.');
  if (serveStatic(req, res)) return;
  route(req, res);
});
server.listen(port, '127.0.0.1', () => console.log(`DaggerForge API listening on http://127.0.0.1:${port}`));
