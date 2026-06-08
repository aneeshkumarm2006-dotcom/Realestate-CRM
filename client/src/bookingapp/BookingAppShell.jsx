/* ============================================================
   BookingAppShell — the standalone Calendly-style booking app
   chrome (own sidebar + topband). Opens in its own browser tab,
   separate from the main CRM shell. Scoped under `.bkapp`.
   ============================================================ */
import { useNavigate } from 'react-router-dom';
import {
  Plus, Link2, Video, Clock, Users, Workflow, LayoutGrid, GitMerge,
  BarChart3, HelpCircle,
} from 'lucide-react';
import useOrgStore from '../store/orgStore';
import './bookingApp.css';

const NAV = [
  { key: 'scheduling', label: 'Scheduling', icon: Link2, to: '/booking-app' },
  { key: 'meetings', label: 'Meetings', icon: Video, soon: true },
  { key: 'availability', label: 'Availability', icon: Clock, soon: true },
  { key: 'contacts', label: 'Contacts', icon: Users, soon: true },
  { key: 'workflows', label: 'Workflows', icon: Workflow, to: '/booking-app/workflows' },
  { key: 'integrations', label: 'Integrations', icon: LayoutGrid, soon: true },
  { key: 'routing', label: 'Routing', icon: GitMerge, soon: true },
];

function Sidebar({ active }) {
  const navigate = useNavigate();
  return (
    <aside className="side">
      <div className="side-brand">
        <div className="side-logo">SI</div>
        <div><div className="nm">Sommet</div><div className="tg">Immobilier</div></div>
      </div>
      <button type="button" className="side-create" onClick={() => navigate('/booking-app')}>
        <Plus size={19} /> Create
      </button>
      <nav className="nav">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = n.key === active;
          return (
            <a
              key={n.key}
              className={'nav-item' + (isActive ? ' active' : '')}
              href={n.to || '#'}
              onClick={(e) => { e.preventDefault(); if (n.to) navigate(n.to); }}
              style={n.soon ? { opacity: 0.7 } : undefined}
            >
              <Icon size={19} strokeWidth={1.9} />{n.label}
              {n.soon && <span className="badge" style={{ background: 'var(--border-2)', color: 'var(--muted)' }}>SOON</span>}
            </a>
          );
        })}
      </nav>
      <div className="side-foot">
        <a className="nav-item" href="#" onClick={(e) => e.preventDefault()}><BarChart3 size={19} strokeWidth={1.9} />Analytics</a>
        <a className="nav-item" href="#" onClick={(e) => e.preventDefault()}><HelpCircle size={19} strokeWidth={1.9} />Help</a>
      </div>
    </aside>
  );
}

export default function BookingAppShell({ active, topband, children }) {
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const initials = (currentOrg?.name || 'CT').slice(0, 2).toUpperCase();
  return (
    <div className="bkapp">
      <div className="app">
        <Sidebar active={active} />
        <div className="main">
          {topband && <div className="topband">{topband}</div>}
          <div className="account"><div className="av">{initials}</div></div>
          <div className="content">{children}</div>
        </div>
      </div>
    </div>
  );
}
