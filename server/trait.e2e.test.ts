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
    const advanced = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${created.value.id}/level-up`, 'POST', { level: 2, choices: [{ type: 'traits', traits: ['agility', 'presence'] }, { type: 'proficiency' }] }, campaign.value.gmToken);
    expect(advanced.status).toBe(200);
    expect(advanced.value.traits.agility).toEqual({ value: '+3', marked: false });
    expect(advanced.value.traits.presence).toEqual({ value: '+1', marked: false });
    expect(advanced.value.traitProgression).toMatchObject({ tier: 2, increasedTraits: ['agility', 'presence'], traitAdvancementUses: 1 });
    const blocked = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${created.value.id}/level-up`, 'POST', { level: 3, choices: [{ type: 'traits', traits: ['agility', 'strength'] }, { type: 'proficiency' }] }, campaign.value.gmToken);
    expect(blocked.status).toBe(409);
    const reloaded = await request(`/api/campaigns/${campaign.value.campaign.id}`, 'GET', undefined, campaign.value.gmToken);
    const reloadedCharacter = reloaded.value.characters.find((character: any) => character.id === created.value.id);
    expect(reloadedCharacter.traits.agility).toEqual({ value: '+3', marked: false });
    expect(reloadedCharacter.traitProgression.traitAdvancementUses).toBe(1);
  });

  it('enforces tier resets, three uses per tier, maximum values, and audited level-ups', async () => {
    const campaign = await request('/api/campaigns', 'POST', { name: 'Trait Progression E2E' });
    const traits = { agility: { value: '+2' }, strength: { value: '+1' }, finesse: { value: '+1' }, instinct: { value: '0' }, presence: { value: '0' }, knowledge: { value: '-1' } };
    const created = await request(`/api/campaigns/${campaign.value.campaign.id}/characters`, 'POST', { name: 'Progression Hero', className: 'Bard', ancestry: 'Human', traits }, campaign.value.gmToken);
    expect(created.status).toBe(201);
    let current = created.value;
    const levelUp = async (level: number, selectedTraits?: string[]) => {
      const choices = selectedTraits ? [{ type: 'traits', traits: selectedTraits }, { type: 'proficiency' }] : [{ type: 'proficiency' }, { type: 'experience', text: `Level ${level} note` }];
      const result = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/level-up`, 'POST', { level, choices }, campaign.value.gmToken);
      expect(result.status).toBe(200);
      current = result.value;
    };
    await levelUp(2, ['agility', 'presence']);
    await levelUp(3, ['strength', 'finesse']);
    await levelUp(4, ['instinct', 'knowledge']);
    expect(current.traitProgression.traitAdvancementUses).toBe(3);
    await levelUp(5, ['agility', 'presence']);
    expect(current.traitProgression).toMatchObject({ tier: 3, traitAdvancementUses: 1, increasedTraits: ['agility', 'presence'] });
    expect(current.traits.agility.value).toBe('+4');
    await levelUp(6, ['strength', 'finesse']);
    await levelUp(7, ['instinct', 'knowledge']);
    expect(current.traitProgression.traitAdvancementUses).toBe(3);
    await levelUp(8, ['agility', 'presence']);
    expect(current.traitProgression).toMatchObject({ tier: 4, traitAdvancementUses: 1, increasedTraits: ['agility', 'presence'] });
    expect(current.traits.agility.value).toBe('+5');
    const capped = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/level-up`, 'POST', { level: 9, choices: [{ type: 'traits', traits: ['agility', 'strength'] }, { type: 'proficiency' }] }, campaign.value.gmToken);
    expect(capped.status).toBe(400);
    const manual = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}`, 'PATCH', { version: current.version, traits }, campaign.value.gmToken);
    expect(manual.status).toBe(400);
    const events = await request(`/api/campaigns/${campaign.value.campaign.id}/events?operation=advancement.level-up`, 'GET', undefined, campaign.value.gmToken);
    expect(events.status).toBe(200);
    expect(events.value.events.length).toBe(7);
    expect(events.value.events[0].summary).toContain('Level 8');
  });

  it('persists interactive resources, advancement caps, overflow, armor slots, and audit summaries', async () => {
    const campaign = await request('/api/campaigns', 'POST', { name: 'Resource E2E' });
    const created = await request(`/api/campaigns/${campaign.value.campaign.id}/characters`, 'POST', { name: 'Resource Hero', className: 'Bard', ancestry: 'Human', armorName: 'Gambeson Armor' }, campaign.value.gmToken);
    expect(created.status).toBe(201);
    expect(created.value).toMatchObject({ hp: 0, hpMax: 5, stress: 0, stressMax: 7, hope: 2, hopeMax: 6, armorScore: 3 });
    expect(created.value.armorSlots).toHaveLength(3);
    let current = created.value;
    const advance = async (level: number, type: string) => { const result = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/level-up`, 'POST', { level, choices: [{ type }, { type: 'proficiency' }] }, campaign.value.gmToken); expect(result.status).toBe(200); current = result.value; };
    await advance(2, 'hp');
    expect(current.hpMax).toBe(6);
    await advance(3, 'stress');
    expect(current.stressMax).toBe(8);
    const markedHp = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'hp', action: 'mark', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(markedHp.value.hp).toBe(1); current = markedHp.value;
    const clearedHp = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'hp', action: 'clear', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(clearedHp.value.hp).toBe(0); current = clearedHp.value;
    const fullStress = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'stress', action: 'mark', amount: 8, version: current.version }, campaign.value.gmToken);
    expect(fullStress.value.stress).toBe(8); current = fullStress.value;
    const overflow = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'stress', action: 'mark', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(overflow.value.stress).toBe(8); expect(overflow.value.hp).toBe(1); current = overflow.value;
    const spentHope = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'hope', action: 'spend', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(spentHope.value.hope).toBe(1); current = spentHope.value;
    const restoredHope = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'hope', action: 'gain', amount: 20, version: current.version }, campaign.value.gmToken);
    expect(restoredHope.value.hope).toBe(6); current = restoredHope.value;
    const markedArmor = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'armor', action: 'mark', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(markedArmor.value.armorScore).toBe(3); expect(markedArmor.value.armorSlots.filter((slot: any) => slot.marked)).toHaveLength(1); current = markedArmor.value;
    const clearedArmor = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${current.id}/resources`, 'POST', { resource: 'armor', action: 'clear', amount: 1, version: current.version }, campaign.value.gmToken);
    expect(clearedArmor.value.armorSlots.filter((slot: any) => slot.marked)).toHaveLength(0);
    let hpCapped = await request(`/api/campaigns/${campaign.value.campaign.id}/characters`, 'POST', { name: 'HP Cap Hero', className: 'Bard', ancestry: 'Human' }, campaign.value.gmToken);
    for (let level = 2; level <= 8; level += 1) hpCapped = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${hpCapped.value.id}/level-up`, 'POST', { level, choices: [{ type: 'hp' }, { type: 'proficiency' }] }, campaign.value.gmToken);
    expect(hpCapped.value.hpMax).toBe(12);
    let stressCapped = await request(`/api/campaigns/${campaign.value.campaign.id}/characters`, 'POST', { name: 'Stress Cap Hero', className: 'Bard', ancestry: 'Human' }, campaign.value.gmToken);
    for (let level = 2; level <= 6; level += 1) stressCapped = await request(`/api/campaigns/${campaign.value.campaign.id}/characters/${stressCapped.value.id}/level-up`, 'POST', { level, choices: [{ type: 'stress' }, { type: 'proficiency' }] }, campaign.value.gmToken);
    expect(stressCapped.value.stressMax).toBe(12);
    const events = await request(`/api/campaigns/${campaign.value.campaign.id}/events?operation=character.resource`, 'GET', undefined, campaign.value.gmToken);
    expect(events.value.events.length).toBeGreaterThanOrEqual(7);
    expect(events.value.events.some((event: any) => event.summary.includes('overflow') || event.summary.includes('stress'))).toBe(true);
  });
});
