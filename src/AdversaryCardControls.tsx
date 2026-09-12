import React, { useState } from 'react';
import { Modal } from './ProductionOverlays';

export default function AdversaryCardControls({ adversary, onPatch }: { adversary: any; onPatch: (body: Record<string, unknown>) => Promise<void> }) {
  const [amount, setAmount] = useState(1);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(adversary.name);
  const [busy, setBusy] = useState(false);
  const apply = async (body: Record<string, unknown>) => { setBusy(true); try { await onPatch(body); } finally { setBusy(false); } };
  return <>
    <div className="adversary-card-actions"><label className="sr-only" htmlFor={'damage-' + adversary.id}>Damage or healing amount</label><input id={'damage-' + adversary.id} className="form-input runtime-amount" type="number" min="1" value={amount} disabled={busy} onChange={event => setAmount(Math.max(1, Number(event.target.value) || 1))} /><button className="mini-plus" disabled={busy} aria-label={'Damage ' + adversary.name} onClick={() => void apply({ adversaryId: adversary.id, hp: Math.max(0, adversary.hp - amount) })}>−</button><button className="mini-plus" disabled={busy} aria-label={'Heal ' + adversary.name} onClick={() => void apply({ adversaryId: adversary.id, hp: Math.min(adversary.hpMax, adversary.hp + amount) })}>+</button><button className="text-button" disabled={busy} onClick={() => { setName(adversary.name); setEditing(true); }}>Manage</button>{busy && <span className="action-status" role="status">Saving…</span>}</div>
    {editing && <Modal title={'Manage ' + adversary.name} eyebrow="RUNTIME INSTANCE" onClose={() => { if (!busy) setEditing(false); }}><label className="form-label">Display name<input className="form-input" disabled={busy} value={name} onChange={event => setName(event.target.value)} /></label><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button><button className="button secondary danger-button" disabled={busy} onClick={async () => { await apply({ removeAdversaryId: adversary.id }); setEditing(false); }}>Remove instance</button><button className="button primary" disabled={busy} onClick={async () => { if (name.trim()) await apply({ renameAdversary: { adversaryId: adversary.id, name: name.trim() } }); setEditing(false); }}>{busy ? 'Saving…' : 'Save name'}</button></div></Modal>}
  </>;
}
