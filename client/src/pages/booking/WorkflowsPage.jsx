/* ============================================================
   Workflows — Calendly-style booking email reminders. WIRED to
   real BookingWorkflow CRUD (org-scoped). The reminder/alert
   emails are sent by the server runner (on-booking + before-event).
   ============================================================ */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, MoreHorizontal, Workflow as WorkflowIcon } from 'lucide-react';
import BookingAppShell from '../../bookingapp/BookingAppShell';
import * as bookingService from '../../services/bookingService';
import useOrgStore from '../../store/orgStore';

const DOT_COLORS = ['#0E9F8E', '#0B69FF', '#7C5CFF', '#E0982E', '#E0568A', '#16A06A'];

const triggerLabel = (w) => {
  if (w.triggerType === 'on_booking') return 'Immediately when new event is booked';
  const m = Number(w.beforeMinutes) || 0;
  if (m % 60 === 0) return `${m / 60} hour${m / 60 === 1 ? '' : 's'} before event starts`;
  return `${m} minutes before event starts`;
};
const actionLabel = (type) =>
  type === 'email_host' ? 'Send email to host' : type === 'email_other' ? 'Send email to someone else' : 'Send email to invitee';
const appliesLabel = (w) => {
  if (!w.links || w.links.length === 0) return 'All event types';
  const first = w.links[0]?.title || 'Event type';
  return w.links.length > 1 ? `${first} +${w.links.length - 1}` : first;
};

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg?._id) return;
    setLoading(true); setError(false);
    try { setWorkflows(await bookingService.listBookingWorkflows(currentOrg._id)); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [currentOrg?._id]);

  useEffect(() => { load(); }, [load]);

  const edit = (id) => navigate(id ? `/booking-app/workflows/edit?id=${id}` : '/booking-app/workflows/edit');
  const remove = async (w) => {
    if (!window.confirm(`Delete workflow "${w.name}"?`)) return;
    try { await bookingService.deleteBookingWorkflow(w._id); setWorkflows((s) => s.filter((x) => x._id !== w._id)); } catch { load(); }
  };

  return (
    <BookingAppShell active="workflows" topband={<>Reminders &amp; follow-ups run automatically for every booking <button type="button" className="tb-btn">Learn more →</button></>}>
      <div className="page-h"><h1>Workflows</h1><span className="help">?</span></div>

      <div className="toolbar">
        <div className="select-pill">{currentOrg?.name || 'Sommet Immobilier'} <ChevronDown size={16} /></div>
      </div>

      <div className="tabs">
        <a className="tab active" href="#" onClick={(e) => e.preventDefault()}>My workflows</a>
        <a className="tab" href="#" onClick={(e) => e.preventDefault()}>Admin managed workflows <span className="new">NEW</span></a>
      </div>

      <div className="owner">
        <div className="oav">{(currentOrg?.name || 'SI').slice(0, 2).toUpperCase()}</div>
        <div className="onm">{currentOrg?.name || 'Sommet Immobilier'}</div>
        <div className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit()}><Plus size={16} />New Workflow</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 2px' }}>Loading workflows…</div>
      ) : error ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 2px' }}>Couldn’t load workflows. <button type="button" onClick={load} style={{ color: 'var(--blue-ink)', fontWeight: 600 }}>Retry</button></div>
      ) : workflows.length === 0 ? (
        <div className="wf-table" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: 'var(--blue-tint)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><WorkflowIcon size={24} /></div>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 18 }}>No workflows yet</div>
          <div style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 380, margin: '6px auto 16px' }}>Create a reminder so leads and agents get an email before each tour, or an alert the moment a visit is booked.</div>
          <button type="button" className="btn btn-primary" onClick={() => edit()}><Plus size={16} />New Workflow</button>
        </div>
      ) : (
        <div className="wf-table">
          <div className="wf-head"><div>Name</div><div>Applies to</div><div>When this happens</div><div>Do this</div><div /></div>
          {workflows.map((w, i) => (
            <div className="wf-row" key={w._id} onClick={() => edit(w._id)} style={!w.enabled ? { opacity: 0.6 } : undefined}>
              <div className="wf-name">{w.name}</div>
              <div className="wf-applies"><span className="dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} /><span>{appliesLabel(w)}</span></div>
              <div className="wf-when">{triggerLabel(w)}</div>
              <div className="wf-do">{(w.actions || []).length ? w.actions.map((a, j) => <div key={j}>{actionLabel(a.type)}</div>) : <span style={{ color: 'var(--muted)' }}>No actions</span>}</div>
              <button type="button" className="iconbtn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(w); }}><MoreHorizontal size={18} /></button>
            </div>
          ))}
        </div>
      )}
    </BookingAppShell>
  );
}
