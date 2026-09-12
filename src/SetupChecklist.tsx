import React, { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { apiRequest, getApiSession } from './api';

type Props = { onCharacters: () => void; onInvite: () => void; onSessions: () => void; onLibrary: () => void; onPlay: () => void };

export default function SetupChecklist({ onCharacters, onInvite, onSessions, onLibrary, onPlay }: Props) {
  const [state, setState] = useState<any>(null);
  useEffect(() => { const session = getApiSession(); if (session?.role === 'GM') apiRequest<any>('/api/campaigns/' + session.campaignId).then(setState).catch(() => {}); }, []);
  if (!state || state.mode === 'PLAY') return null;
  const characters = Array.isArray(state.characters) ? state.characters : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const participants = Array.isArray(state.participants) ? state.participants : [];
  const items = [
    { key: 'campaign', label: 'Campaign created', done: Boolean(state.id), action: null as null | (() => void) },
    { key: 'characters', label: 'Create and complete a character', done: characters.some((character: any) => character.complete), action: onCharacters },
    { key: 'players', label: 'Invite players', done: participants.length > 0, action: onInvite },
    { key: 'encounter', label: 'Prepare an encounter', done: (state.encounters || []).length > 0 || (state.encounterTemplates || []).length > 0, action: onLibrary },
    { key: 'session', label: 'Start your first session', done: sessions.length > 0, action: onSessions },
    { key: 'play', label: 'Enter Play mode when ready', done: false, action: onPlay },
  ];
  const complete = items.filter(item => item.done).length;
  return <section className="panel setup-checklist" aria-label="Campaign setup checklist">
    <div className="panel-head"><div><span className="section-label">FIRST SESSION SETUP</span><h2>Ready the campaign</h2><p>{complete} of {items.length - 1} preparation steps complete</p></div></div>
    <div className="checklist-items">{items.map(item => <div className={'checklist-item ' + (item.done ? 'done' : '')} key={item.key}><span className="checklist-check">{item.done ? <Check size={14} /> : <i />}</span><span>{item.label}</span>{item.action && !item.done && <button className="text-button" onClick={item.action}>Open <ChevronRight size={14} /></button>}</div>)}</div>
  </section>;
}
