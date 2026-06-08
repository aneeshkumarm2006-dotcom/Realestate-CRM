/* ============================================================
   Scheduling — Calendly-style event-type hub, wired to REAL
   booking links (BookingLink CRUD) aggregated across all boards.
   ============================================================ */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, Link2, ExternalLink, MoreHorizontal, Check, Calendar } from 'lucide-react';
import BookingAppShell from '../../bookingapp/BookingAppShell';
import * as bookingService from '../../services/bookingService';
import useBoardStore from '../../store/boardStore';
import useOrgStore from '../../store/orgStore';

const BAR_COLORS = ['#7C5CFF', '#0B69FF', '#0E9F8E', '#E0982E', '#E0568A', '#16A06A'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const availabilitySummary = (link) => {
  const days = (link.weeklyHours || []).map((w) => Number(w.dayOfWeek));
  if (!days.length) return 'No availability set';
  const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d));
  if (isWeekdays) return 'Weekdays, hours vary';
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  return sorted.map((d) => DOW[d]).join(', ') + ', hours vary';
};

function EventCard({ link, color, navigate }) {
  const [copied, setCopied] = useState(false);
  const url = (link.publicUrl || '').replace(/^https?:\/\//, '');
  const copy = () => {
    navigator.clipboard?.writeText(link.publicUrl || url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="et-card">
      <div className="et-bar" style={{ background: link.branding?.accentColor || color }} />
      <div className="et-body">
        <div className="et-check" />
        <div className="et-info">
          <div className="et-title">{link.title}</div>
          <div className="et-meta">{link.durationMinutes} min · {link.location || '1 location'} · One-on-One</div>
          <div className="et-sub">{availabilitySummary(link)}</div>
        </div>
        <div className="et-actions">
          <button type="button" className={'copy-link' + (copied ? ' done' : '')} onClick={copy}>
            {copied ? <Check size={15} /> : <Link2 size={15} />}{copied ? 'Copied!' : 'Copy link'}
          </button>
          <button type="button" className="iconbtn" title="Open booking page" onClick={() => link.publicUrl && window.open(link.publicUrl, '_blank')}>
            <ExternalLink size={18} />
          </button>
          <button type="button" className="iconbtn" title="Edit" onClick={() => navigate('/booking')}>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulingPage() {
  const navigate = useNavigate();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!currentOrg?._id) return;
    setLoading(true); setError(false);
    try {
      const bs = boards.length ? boards : await fetchBoards(currentOrg._id);
      const per = await Promise.all((bs || []).map((b) => bookingService.listBookingLinks(b._id).catch(() => [])));
      setLinks(per.flat());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const shown = links.filter((l) => !q || (l.title || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <BookingAppShell active="scheduling" topband={<>A refreshed booking experience is live for your clients <button type="button" className="tb-btn">Preview →</button></>}>
      <div className="page-h">
        <h1>Scheduling</h1>
        <span className="help">?</span>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => navigate('/booking')}><Plus size={17} />Create</button>
      </div>

      <div className="tabs">
        <a className="tab active" href="#" onClick={(e) => e.preventDefault()}>Event types</a>
        <a className="tab" href="#" onClick={(e) => e.preventDefault()}>Single-use links</a>
        <a className="tab" href="#" onClick={(e) => e.preventDefault()}>Meeting polls</a>
      </div>

      <div className="toolbar">
        <div className="select-pill">{currentOrg?.name || 'Sommet Immobilier'} <ChevronDown size={16} /></div>
        <div className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search event types" /></div>
        <div className="filter"><Filter size={16} />Filter</div>
      </div>

      <div className="owner">
        <div className="oav">{(currentOrg?.name || 'SI').slice(0, 2).toUpperCase()}</div>
        <div className="onm">{currentOrg?.name || 'Sommet Immobilier'}</div>
        <div className="spacer" />
        <a className="landing" href="#" onClick={(e) => e.preventDefault()}><ExternalLink size={15} />View landing page</a>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>Loading event types…</div>
      ) : error ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>
          Couldn’t load booking links. <button type="button" className="ic-link" onClick={load} style={{ color: 'var(--blue-ink)', fontWeight: 600 }}>Retry</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="et-card" style={{ padding: '40px', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--blue-tint)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}><Calendar size={26} /></div>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 18 }}>No event types yet</div>
          <div style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 360 }}>Create your first booking link and clients can schedule property tours themselves.</div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/booking')}><Plus size={16} />Create event type</button>
        </div>
      ) : (
        <div>
          {shown.map((l, i) => <EventCard key={l._id} link={l} color={BAR_COLORS[i % BAR_COLORS.length]} navigate={navigate} />)}
        </div>
      )}
    </BookingAppShell>
  );
}
