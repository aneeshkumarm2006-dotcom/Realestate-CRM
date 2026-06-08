/* ============================================================
   Workflows — Calendly-style booking email reminders (UI).
   Visual/clickable for now; the reminder-sending backend lands
   in a follow-up. Sample real-estate reminder workflows.
   ============================================================ */
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, MoreHorizontal } from 'lucide-react';
import BookingAppShell from '../../bookingapp/BookingAppShell';

const C = { dorchester: '#0E9F8E', gramercy: '#0B69FF', le2100: '#7C5CFF' };
const WF = [
  { name: '24 hrs Email reminder to the Lead and Adil for Dorchester', applies: 'Dorchester — Property Tour', c: C.dorchester, when: '24 hours before event starts', does: ['Send email to someone else', 'Send email to invitee'] },
  { name: '24 hrs Email reminder to the Lead and Stephanie for Gramercy', applies: 'Gramercy Residences — Property Tour', c: C.gramercy, when: '24 hours before event starts', does: ['Send email to invitee', 'Send email to someone else'] },
  { name: '24 hrs Email reminder to the Lead and Stephanie for Le 2100', applies: 'Le 2100 Maisonneuve — Property Tour', c: C.le2100, when: '24 hours before event starts', does: ['Send email to invitee', 'Send email to someone else'], hot: true },
  { name: 'Email for New Lead Visit Booking to Adil for Dorchester', applies: 'Dorchester — Property Tour', c: C.dorchester, when: 'Immediately when new event is booked', does: ['Send email to someone else'] },
  { name: 'Email for New Lead Visit Booking to Stephanie for Gramercy', applies: 'Gramercy Residences — Property Tour', c: C.gramercy, when: 'Immediately when new event is booked', does: ['Send email to someone else'] },
  { name: 'Email for New Lead Visit Booking to Stephanie for Le 2100', applies: 'Le 2100 Maisonneuve — Property Tour', c: C.le2100, when: 'Immediately when new event is booked', does: ['Send email to someone else'] },
  { name: '2 hr reminder to Lead and Agent (Adil) for Dorchester', applies: 'Dorchester — Property Tour', c: C.dorchester, when: '2 hours before event starts', does: ['Send email to invitee', 'Send email to someone else'] },
];

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const edit = () => navigate('/booking-app/workflows/edit');
  return (
    <BookingAppShell active="workflows" topband={<>Reminders &amp; follow-ups run automatically for every booking <button type="button" className="tb-btn">Learn more →</button></>}>
      <div className="page-h"><h1>Workflows</h1><span className="help">?</span></div>

      <div className="toolbar">
        <div className="select-pill">Sommet Immobilier <ChevronDown size={16} /></div>
      </div>

      <div className="tabs">
        <a className="tab active" href="#" onClick={(e) => e.preventDefault()}>My workflows</a>
        <a className="tab" href="#" onClick={(e) => e.preventDefault()}>Admin managed workflows <span className="new">NEW</span></a>
      </div>

      <div className="owner">
        <div className="oav">SI</div><div className="onm">Sommet Immobilier</div>
        <div className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={edit}><Plus size={16} />New Workflow</button>
      </div>

      <div className="wf-table">
        <div className="wf-head"><div>Name</div><div>Applies to</div><div>When this happens</div><div>Do this</div><div /></div>
        {WF.map((w, i) => (
          <div className="wf-row" key={i} onClick={edit}>
            <div className="wf-name" style={w.hot ? { color: 'var(--blue-ink)' } : undefined}>{w.name}</div>
            <div className="wf-applies"><span className="dot" style={{ background: w.c }} /><span>{w.applies}</span></div>
            <div className="wf-when">{w.when}</div>
            <div className="wf-do">{w.does.map((d, j) => <div key={j}>{d}</div>)}</div>
            <button type="button" className="iconbtn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><MoreHorizontal size={18} /></button>
          </div>
        ))}
      </div>
    </BookingAppShell>
  );
}
