import React, { useState } from 'react';
import { ChevronDown, LogOut, Plus } from 'lucide-react';
import { AccessContext } from './access-context';

type Props = {
  active: AccessContext;
  contexts: AccessContext[];
  onSwitch: (context: AccessContext) => void;
  onCreate: () => void;
  onLeave: () => void;
};

export default function CampaignSwitcher({ active, contexts, onSwitch, onCreate, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  const alternatives = contexts.filter(context => context.role === active.role);
  return <div className="campaign-switcher-wrap">
    <button className="campaign-switcher" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
      <div className="campaign-icon">✦</div><div><small>CAMPAIGN · {active.role}</small><b>{active.name}</b></div><ChevronDown size={16} />
    </button>
    {open && <div className="campaign-switcher-menu" role="menu">
      <div className="campaign-switcher-menu-title">Your campaign access</div>
      {alternatives.map(context => <button role="menuitem" className={context.campaignId === active.campaignId ? 'active' : ''} key={context.role + ':' + context.campaignId} onClick={() => { setOpen(false); if (context.campaignId !== active.campaignId) onSwitch(context); }}>
        <span><b>{context.name}</b><small>{context.role === 'GM' ? 'GM controller' : 'Player access'}</small></span>{context.campaignId === active.campaignId && <i>Active</i>}
      </button>)}
      <button role="menuitem" onClick={() => { setOpen(false); onCreate(); }}><Plus size={15} /> Add campaign</button>
      <button role="menuitem" className="danger-button" onClick={() => { setOpen(false); onLeave(); }}><LogOut size={15} /> Leave this access</button>
    </div>}
  </div>;
}
