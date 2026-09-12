import React from 'react';
import { Box, Heart, Shield, Sparkles, Swords, Zap } from 'lucide-react';

const traitNames = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'] as const;
const traitLabels: Record<string, string> = { agility: 'Agility', strength: 'Strength', finesse: 'Finesse', instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge' };
const traitActions: Record<string, string[]> = {
  agility: ['Sprint', 'Leap', 'Maneuver'], strength: ['Lift', 'Smash', 'Grapple'], finesse: ['Control', 'Hide', 'Tinker'],
  instinct: ['Perceive', 'Sense', 'Navigate'], presence: ['Charm', 'Perform', 'Deceive'], knowledge: ['Recall', 'Analyze', 'Comprehend'],
};

type Props = { c: any; mode: 'PREPARATION' | 'PLAY'; onUpdate: (id: string, change: Record<string, any>, text: string) => void | Promise<void>; onResourceAction?: (id: string, resource: string, action: string, amount: number, text: string) => Promise<void>; onAdvance?: () => void; onOpenConfiguration?: () => void };

function valueOf(c: any, name: string) { return c.traits?.[name]?.value ?? c.traits?.[name] ?? '—'; }
function pipCount(c: any, resource: string) { return resource === 'armor' ? (c.armorSlots || []).filter((slot: any) => slot.marked).length : Number(c[resource] || 0); }

function Pips({ label, value, max, color, onChange }: { label: string; value: number; max: number; color: string; onChange: (value: number) => void }) {
  const count = Math.max(0, Number(max) || 0);
  return <div className="resource-track"><div className="resource-track-head"><span>{label}</span><b>{value}<small> / {count}</small></b></div><div className="resource-pips">{Array.from({ length: count }, (_, index) => <button type="button" key={index} className={'resource-pip ' + (index < value ? 'filled' : '')} style={index < value ? { '--pip-color': color } as React.CSSProperties : undefined} aria-label={`${label} ${index + 1}`} onClick={() => onChange(index + 1 === value ? index : index + 1)} />)}</div></div>;
}

function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`sheet-panel ${className}`}><div className="sheet-panel-title"><div>{eyebrow && <span className="section-label">{eyebrow}</span>}<h3>{title}</h3></div></div>{children}</section>;
}

function Traits({ c }: { c: any }) {
  return <section className="sheet-traits" aria-label="Traits"><div className="sheet-section-heading"><div><span className="section-label">CORE TRAITS</span><h3>Traits</h3></div><span className="muted-copy">Modifier · actions</span></div><div className="sheet-traits-grid">{traitNames.map(name => <article className="sheet-trait-card" key={name}><div className="trait-card-head"><span>{traitLabels[name]}</span><strong>{valueOf(c, name)}</strong></div><div className="trait-actions">{traitActions[name].map(action => <span key={action}>{action}</span>)}</div></article>)}</div></section>;
}

export default function CharacterSheetGameplay({ c, mode, onUpdate, onResourceAction, onAdvance, onOpenConfiguration }: Props) {
  const setResource = (resource: string, value: number) => {
    const current = resource === 'armor' ? pipCount(c, resource) : Number(c[resource] || 0); const amount = Math.abs(value - current); if (!amount) return; const action = value > current ? (resource === 'hope' ? 'gain' : 'mark') : (resource === 'hope' ? 'spend' : 'clear'); const text = `${action === 'mark' || action === 'gain' ? 'increased' : 'decreased'} ${c.name}'s ${resource} by ${amount}`;
    if (onResourceAction) { void onResourceAction(c.id, resource, action, amount, text); return; }
    if (resource === 'armor') { const slots = (c.armorSlots || []).map((slot: any, index: number) => ({ ...slot, marked: index < value })); onUpdate(c.id, { armorSlots: slots }, text); return; }
    const max = resource === 'hope' ? 6 : Number(c[`${resource}Max`] || 0); onUpdate(c.id, { [resource]: Math.max(0, Math.min(max, value)) }, text);
  };
  const armorMarked = pipCount(c, 'armor'); const armorMax = (c.armorSlots || []).length || Number(c.armorSlotsCapacity || c.armorScore || 0);
  return <>
    <div className="sheet-section-nav" aria-label="Character sheet sections"><a href="#damage-health">Resources</a><a href="#active-weapons">Loadout</a><a href="#experiences">Growth</a><a href="#inventory">Inventory</a>{mode === 'PREPARATION' && onOpenConfiguration && <button type="button" className="text-button" onClick={onOpenConfiguration}>Edit configuration</button>}</div>
    <section className="sheet-top"><div className="sheet-identity-grid"><div><span className="section-label">HERITAGE / ANCESTRY</span><strong>{c.ancestry || '—'}</strong><small>{c.community || 'Community not configured'}</small></div><div><span className="section-label">CLASS + SUBCLASS</span><strong>{c.className || '—'}</strong><small>{c.subclassName || 'Subclass not configured'}</small></div><div className="sheet-level"><span className="section-label">LEVEL</span><strong>{c.level}</strong><small>Tier {c.traitProgression?.tier || 1}{onAdvance && <button type="button" className="text-button" onClick={onAdvance}>Advance</button>}</small></div></div><div className="sheet-stat-strip"><div className="sheet-stat-card"><span>Evasion</span><strong>{c.evasion ?? '—'}</strong><small>Defense</small></div><div className="sheet-stat-card armor-stat"><span>Armor</span><strong>{c.armorScore ?? c.armor ?? 0}</strong><small>{armorMarked} / {armorMax} slots marked</small></div></div></section>
    <Traits c={c} /><div className="sheet-progression-summary"><span>Tier {c.traitProgression?.tier || 1}</span><strong>Trait Advancement uses: {c.traitProgression?.traitAdvancementUses || 0} / 3</strong>{Array.isArray(c.traitProgression?.increasedTraits) && c.traitProgression.increasedTraits.length > 0 && <span>Increased this Tier: {c.traitProgression.increasedTraits.map((name: string) => traitLabels[name]).join(', ')}</span>}{onAdvance && <button type="button" className="button secondary" onClick={onAdvance}>Level up</button>}</div>
    <div className="sheet-gameplay-grid"><div className="sheet-column">
      <Panel title="Damage & Health" eyebrow="RESOURCES" className="damage-health-panel"><div className="damage-thresholds"><div><span>Minor</span><strong>1–{Math.max(0, Number(c.majorThreshold || 1) - 1)}</strong></div><div><span>Major</span><strong>{c.majorThreshold ?? '—'}</strong></div><div><span>Severe</span><strong>{c.severeThreshold ?? '—'}</strong></div></div><p className="panel-hint">Mark HP for damage. Stress overflow marks one HP when Stress is full.</p><Pips label="HP" value={Number(c.hp || 0)} max={Number(c.hpMax || 0)} color={c.color} onChange={value => setResource('hp', value)} /><Pips label="Stress" value={Number(c.stress || 0)} max={Number(c.stressMax || 6)} color="#8f7bd0" onChange={value => setResource('stress', value)} /></Panel>
      <Panel title="Hope" eyebrow="RESOURCE" className="hope-panel"><p className="panel-hint">Spend Hope to use an Experience or help an ally.</p><Pips label="Hope" value={Number(c.hope || 0)} max={6} color="#d0a75b" onChange={value => setResource('hope', value)} />{c.hopeFeature && <div className="feature-copy">{c.hopeFeature}</div>}</Panel>
      <Panel title="Experiences" eyebrow="GROWTH" className="experiences-panel"><div id="experiences">{Array.isArray(c.experiences) && c.experiences.length ? c.experiences.map((experience: any) => <div className="experience-row" key={experience.text || experience.name}><span>{experience.text || experience.name}</span><b>{experience.modifier || '+2'}</b></div>) : <div className="empty-state">No experiences configured.</div>}</div></Panel>
    </div><div className="sheet-column">
      <Panel title="Active Weapons" eyebrow="LOADOUT" className="weapons-panel">{[c.primaryWeapon, c.secondaryWeapon].filter(Boolean).map((weapon: any, index: number) => <article className="weapon-card" key={weapon.slot || weapon.name}><div className="weapon-card-icon">{index === 0 ? <Swords size={18} /> : <Sparkles size={18} />}</div><div><span className="section-label">{weapon.slot || (index === 0 ? 'PRIMARY' : 'SECONDARY')}</span><h4>{weapon.name}</h4><p>{weapon.trait || '—'} · {weapon.range || '—'} · {weapon.damageDice || weapon.damage || '—'}</p><small>{weapon.feature || 'No feature text configured.'}</small></div></article>)}</Panel>
      <Panel title="Active Armor" eyebrow="LOADOUT" className="armor-panel"><div className="armor-summary"><Shield size={22} /><div><strong>{c.armorName || 'No armor equipped'}</strong><span>Score {c.armorScore ?? c.armor ?? 0} · Thresholds {c.majorThreshold ?? '—'} / {c.severeThreshold ?? '—'}</span></div></div><Pips label="Armor slots" value={armorMarked} max={armorMax} color="#7aa7d9" onChange={value => setResource('armor', value)} /><p className="feature-copy">{c.armorFeature || 'No armor feature configured.'}</p></Panel>
      <Panel title="Inventory" eyebrow="CARRIED ITEMS" className="inventory-panel"><div id="inventory">{(c.inventory || []).length ? c.inventory.map((item: string) => <div className="inventory-row" key={item}><Box size={15} /><span>{item}</span></div>) : <div className="empty-state">No items carried.</div>}</div></Panel>
      <Panel title="Domain Cards" eyebrow="LOADOUT" className="domain-panel"><div className="domain-summary"><span><Zap size={14} /> Active</span><b>{(c.domainCards || []).filter((card: any) => !card.inVault).length} / 5</b><small>Vault {(c.domainCards || []).filter((card: any) => card.inVault).length}</small></div>{(c.domainCards || []).filter((card: any) => !card.inVault).slice(0, 5).map((card: any) => <div className="domain-card-row" key={card.id || card.name}><span>{card.name}</span><small>{card.domain || 'Domain'} · Level {card.level || 1}</small></div>)}</Panel>
    </div></div>
  </>;
}
