import React, { useEffect, useRef, useState } from 'react';
import { CircleHelp, MoreHorizontal, X } from 'lucide-react';

export type MenuAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function Modal({ title, eyebrow, children, onClose, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const root = closeRef.current?.closest('[role="dialog"]') as HTMLElement | null;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={event => event.stopPropagation()}>
      <button ref={closeRef} className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id="modal-title">{title}</h2>
      {children}
    </section>
  </div>;
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return <Modal title="DaggerForge help" eyebrow="QUICK GUIDE" onClose={onClose}>
    <div className="help-content">
      <p>Use <strong>Preparation</strong> to configure characters, library content, and encounters. Switch to <strong>Play mode</strong> when the table is ready; configuration fields lock while runtime tracks remain available.</p>
      <div className="help-grid">
        <div><b>Preparation</b><span>Build characters, copy bundled Daggerheart content into your campaign library, and prepare reusable encounter templates.</span></div>
        <div><b>Play mode</b><span>Use Table View for the active scene, Fear, adversary runtime state, and player resources. Ended encounters remain historical.</span></div>
        <div><b>Sessions</b><span>Session titles and notes autosave while you edit. Ending a session requires confirmation and keeps its timeline.</span></div>
        <div><b>History & conflicts</b><span>Event Console filters by current session, character, participant, and event type. Character edits reconcile by field when safe.</span></div>
        <div><b>GM Library</b><span>Bundled Daggerheart content is read-only. Save campaign copies, edit them with guided fields, archive them, or duplicate templates.</span></div>
        <div><b>Connection</b><span>Realtime status appears in the lower corner. Reconnecting and offline states are announced without interrupting the workspace.</span></div>
      </div>
    </div>
  </Modal>;
}

export function OverflowMenu({ label = 'More actions', actions }: { label?: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);
  return <div className="overflow-menu" ref={root}>
    <button className="icon-button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><MoreHorizontal size={18} /></button>
    {open && <div className="overflow-popover" role="menu" aria-label={label}>{actions.map(action => <button key={action.label} role="menuitem" disabled={action.disabled} className={action.destructive ? 'danger-button' : ''} onClick={() => { if (action.disabled) return; action.onSelect(); setOpen(false); }}>{action.label}</button>)}</div>}
  </div>;
}

export function InventoryDialog({ items, disabled, onClose, onSave }: { items: string[]; disabled?: boolean; onClose: () => void; onSave: (items: string[]) => Promise<void> | void }) {
  const [rows, setRows] = useState(items);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const normalized = rows.map(item => item.trim()).filter(Boolean);
    if (normalized.some(item => item.length > 160)) return setError('Each inventory item must be 160 characters or fewer.');
    if (normalized.length > 50) return setError('A character may have at most 50 inventory entries.');
    setError(''); setBusy(true);
    try { await onSave(normalized); onClose(); } catch (event) { setError(event instanceof Error ? event.message : 'Unable to save inventory.'); } finally { setBusy(false); }
  };
  return <Modal title="Manage inventory" eyebrow="CHARACTER INVENTORY" onClose={onClose} className="inventory-modal">
    <p className="muted-copy">Inventory is stored as named entries. Add or remove entries here; quantities are not part of the current character model.</p>
    <div className="inventory-editor-list">{rows.map((item, index) => <div className="repeatable-row" key={index}><input className="form-input" autoFocus={index === 0} disabled={disabled || busy} aria-label={'Inventory item ' + (index + 1)} value={item} placeholder="Item name" onChange={event => setRows(current => current.map((row, rowIndex) => rowIndex === index ? event.target.value : row))} /><button className="icon-button" disabled={disabled || busy} aria-label={'Remove inventory item ' + (index + 1)} onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}>×</button></div>)}</div>
    <button className="text-button" disabled={disabled || busy || rows.length >= 50} onClick={() => setRows(current => [...current, ''])}>Add item</button>
    {error && <div id="inventory-error" className="form-error" role="alert">{error}</div>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" onClick={save} disabled={disabled || busy}>{busy ? 'Saving…' : 'Save inventory'}</button></div>
  </Modal>;
}

export function ConnectionHelpButton({ onClick }: { onClick: () => void }) {
  return <button className="icon-button" aria-label="Open help" onClick={onClick}><CircleHelp size={18} /></button>;
}
