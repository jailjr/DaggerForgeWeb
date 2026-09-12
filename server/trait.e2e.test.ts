import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const port = 8800;
const base = `http://127.0.0.1:${port}`;
let serverProcess: ChildProcess;

function request(path: string, method = 'GET', body?: unknown, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(new URL(path, base), { method, headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } }, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => { let value: any = text; try { value = JSON.parse(text); } catch {} resolve({ status: res.statusCode, value }); });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForHealth() { for (let attempt = 0; attempt < 30; attempt += 1) { try { if ((await request('/health')).status === 200) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Trait E2E server did not start'); }

describe('canonical trait persistence E2E', () => {
  beforeAll(async () => { serverProcess = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ENABLE_BACKUPS: '0', DATA_DIR: path.join(os.tmpdir(), `daggerforge-trait-e2e-${port}-${process.pid}`) }, stdio: 'ignore' }); await waitForHealth(); });
  afterAll(() => { if (serverProcess) serverProcess.kill(); });

  it('keeps named modifiers and marked state stable through API reload', async () => {
    const campaign = await request('/api/campaigns', 'POST', { name: 'Canonical Trait E2E' });
    const traits = { agility: { value: '+2', marked: false }, strength: { value: '+1', marked: false }, finesse: { value: '+1', marked: false }, instinct: { value: '0', marked: false }, presence: { value: '0', marked: false }, knowledge: { value: '-1', marked: false } };
    const created = await request(`/api/campaigns/${campaign.value.campaign.id}/characters`, 'POST', { name: 'Named Traits', className: 'Bard', ancestry: 'Human', traits }, campaign.value.gmToken);
    expect(created.status).toBe(201);
    expect(Object.fromEntries(Object.keys(traits).map(name => [name, created.value.traits[name].value]))).toEqual({ agility: '+2', strength: '+1', finesse: '+1', instinct: '0', presence: '0', knowledge: '-1' });
    const marked = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${created.value.id}`, 'PATCH', { version: created.value.version, traits: { ...created.value.traits, agility: { value: '+2', marked: true } } }, campaign.value.gmToken);
    expect(marked.status).toBe(200);
    expect(marked.value.traits.agility).toEqual({ value: '+2', marked: true });
    const reloaded = await request(`/api/campaigns/${campaign.value.campaign.id}`, 'GET', undefined, campaign.value.gmToken);
    expect(reloaded.value.characters.find((character: any) => character.id === created.value.id).traits.agility).toEqual({ value: '+2', marked: true });
  });
});
