/* ============================================================
   Booking admin (honey/amber) — link manager + editor with a
   real-time live preview. WIRED to real BookingLink CRUD across
   the org's boards (board-scoped on the backend).
   ============================================================ */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageWrapper from '../components/layout/PageWrapper';
import Icon from '../premium/PremiumIcons';
import { Toggle, Sk } from '../premium/PremiumShared';
import PublicBooking from '../premium/PublicBooking';
import { L } from '../premium/premiumData';
import * as bookingService from '../services/bookingService';
import { getGroups } from '../services/taskService';
import useBoardStore from '../store/boardStore';
import useOrgStore from '../store/orgStore';
import useToastStore from '../store/toastStore';

const ACCENTS = [
  { id: 'amber', c: '#E0982E', c2: '#F2754B' },
  { id: 'coral', c: '#F2754B', c2: '#E0982E' },
  { id: 'indigo', c: '#4F46E5', c2: '#7C3AED' },
  { id: 'teal', c: '#0E9F8E', c2: '#34D8C4' },
  { id: 'violet', c: '#7C3AED', c2: '#A78BFA' },
];
const accentObj = (hex) => ACCENTS.find((a) => a.c.toLowerCase() === String(hex || '').toLowerCase()) || ACCENTS[0];
const DAYS = { en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] };
// design day-pill index (0=Mon..6=Sun) → backend dayOfWeek (0=Sun..6=Sat)
const DOW_MAP = [1, 2, 3, 4, 5, 6, 0];

const initials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
function MAvatar({ member, size = 18 }) {
  if (!member) return null;
  return member.profilePic
    ? <img src={member.profilePic} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : <span className="av" style={{ width: size, height: size, fontSize: size * 0.42, background: 'var(--book)' }}>{initials(member.name)}</span>;
}

function LinkCard({ link, members, lang, onToggle, onEdit, onOpen, onDelete }) {
  const [copied, setCopied] = useState(false);
  const acc = accentObj(link.branding?.accentColor);
  const agent = members.find((x) => x._id === (link.agents || [])[0]);
  const url = (link.publicUrl || '').replace(/^https?:\/\//, '');
  const agentLabel = link.assignMode === 'round_robin' ? L({ en: 'Round-robin', fr: 'Rotation' }, lang) : (agent?.name || '—');
  return (
    <div className="link-card">
      <div className="link-cover" style={{ background: `linear-gradient(135deg, ${acc.c}, ${acc.c2})` }}>
        <div className="pub-cover" />
        <span className="lc-dur">{link.durationMinutes} min</span>
        {!link.active && <span className="lc-paused">{L({ en: 'Paused', fr: 'En pause' }, lang)}</span>}
      </div>
      <div className="link-body">
        <div>
          <div className="lb-title">{link.title}</div>
          <div className="lb-agent">{link.assignMode === 'round_robin' ? <Icon name="users" size={14} /> : <MAvatar member={agent} size={18} />}{agentLabel}</div>
        </div>
        <div className="url-row">
          <span className="url">{url}</span>
          <button type="button" className={'url-copy' + (copied ? ' done' : '')} onClick={() => { navigator.clipboard?.writeText(link.publicUrl || url); setCopied(true); setTimeout(() => setCopied(false), 1400); }} aria-label="Copy link">
            <Icon name={copied ? 'check' : 'copy'} size={15} />
          </button>
        </div>
        <div className="link-foot">
          <button type="button" className="link-act" onClick={onOpen} title={L({ en: 'Open', fr: 'Ouvrir' }, lang)}><Icon name="eye" size={16} /></button>
          <button type="button" className="link-act" onClick={onEdit} title={L({ en: 'Edit', fr: 'Modifier' }, lang)}><Icon name="edit" size={15} /></button>
          <button type="button" className="link-act" onClick={onDelete} title={L({ en: 'Delete', fr: 'Supprimer' }, lang)}><Icon name="trash" size={15} /></button>
          <div className="link-toggle">
            <span style={{ color: link.active ? 'var(--done)' : 'var(--muted)' }}>{link.active ? L({ en: 'Active', fr: 'Actif' }, lang) : L({ en: 'Off', fr: 'Inactif' }, lang)}</span>
            <Toggle on={link.active} onChange={onToggle} label="Active" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingEditor({ link, boards, members, lang, onClose, onSaved, onPreviewFull, toastError, toastSuccess }) {
  const fromWeekly = () => {
    const days = [false, false, false, false, false, false, false];
    (link?.weeklyHours || []).forEach((w) => { const i = DOW_MAP.indexOf(Number(w.dayOfWeek)); if (i >= 0) days[i] = true; });
    if (!link) return [true, true, true, true, true, false, false];
    return days;
  };
  const [cfg, setCfg] = useState(() => ({
    title: link ? link.title : (lang === 'fr' ? 'Visite privée' : 'Private property tour'),
    durationMinutes: link ? link.durationMinutes : 30,
    location: link ? (link.location || '') : '',
    timezone: link ? (link.timezone || 'America/Toronto') : 'America/Toronto',
    board: link ? link.board : (boards[0]?._id || ''),
    group: link ? link.group : '',
    agents: link ? [...(link.agents || [])] : (members[0] ? [members[0]._id] : []),
    accent: accentObj(link?.branding?.accentColor).id,
    headline: link?.branding?.headline || (lang === 'fr' ? 'Réservez votre visite' : 'Book your tour'),
    days: fromWeekly(),
    start: link?.weeklyHours?.[0]?.start || '09:00',
    end: link?.weeklyHours?.[0]?.end || '17:00',
    assign: link?.assignMode === 'round_robin' ? 'robin' : 'fixed',
  }));
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setCfg((s) => ({ ...s, [k]: v }));
  const acc = ACCENTS.find((a) => a.id === cfg.accent);

  useEffect(() => {
    if (!cfg.board) { setGroups([]); return; }
    getGroups(cfg.board).then((gs) => {
      setGroups(gs || []);
      setCfg((s) => (s.group && (gs || []).some((g) => g._id === s.group) ? s : { ...s, group: (gs || [])[0]?._id || '' }));
    }).catch(() => setGroups([]));
  }, [cfg.board]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAgent = (id) => set('agents', cfg.agents.includes(id) ? cfg.agents.filter((x) => x !== id) : [...cfg.agents, id]);
  const previewCfg = { title: cfg.title, duration: cfg.durationMinutes, location: cfg.location, agent: members.find((m) => m._id === cfg.agents[0])?.name, accent: acc.c, accent2: acc.c2, logo: 'SI', org: 'Sommet Immobilier' };

  const save = async () => {
    if (!cfg.board || !cfg.group) { toastError(L({ en: 'Pick a board and a group', fr: 'Choisissez un tableau et un groupe' }, lang)); return; }
    if (!cfg.title.trim()) { toastError(L({ en: 'Title is required', fr: 'Le titre est requis' }, lang)); return; }
    const weeklyHours = cfg.days.map((on, i) => (on ? { dayOfWeek: DOW_MAP[i], start: cfg.start, end: cfg.end } : null)).filter(Boolean);
    if (!weeklyHours.length) { toastError(L({ en: 'Pick at least one available day', fr: 'Choisissez au moins un jour' }, lang)); return; }
    const payload = {
      title: cfg.title.trim(),
      group: cfg.group,
      durationMinutes: cfg.durationMinutes,
      location: cfg.location,
      timezone: cfg.timezone,
      weeklyHours,
      assignMode: cfg.assign === 'robin' ? 'round_robin' : 'fixed',
      agents: cfg.assign === 'robin' ? cfg.agents : cfg.agents.slice(0, 1),
      branding: { accentColor: acc.c, headline: cfg.headline },
    };
    setSaving(true);
    try {
      if (link) await bookingService.updateBookingLink(link._id, payload);
      else await bookingService.createBookingLink(cfg.board, payload);
      toastSuccess(L({ en: 'Booking link saved', fr: 'Lien enregistré' }, lang));
      onSaved();
    } catch (err) {
      toastError(err?.response?.data?.error || L({ en: 'Could not save', fr: 'Impossible d’enregistrer' }, lang));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="arrowLeft" size={15} />{L({ en: 'All links', fr: 'Tous les liens' }, lang)}</button>
        <h1 style={{ fontSize: 22 }}>{link ? L({ en: 'Edit booking link', fr: 'Modifier le lien' }, lang) : L({ en: 'New booking link', fr: 'Nouveau lien' }, lang)}</h1>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" style={{ background: 'var(--book)', boxShadow: '0 2px 10px -2px var(--book)' }} disabled={saving} onClick={save}><Icon name="check" size={15} />{L({ en: 'Save', fr: 'Enregistrer' }, lang)}</button>
      </div>

      <div className="bk-editor book">
        <div className="bk-form">
          <div className="bk-section">
            <h3><span className="bs-ic"><Icon name="home" size={15} /></span>{L({ en: 'Where bookings land', fr: 'Où arrivent les réservations' }, lang)}</h3>
            <div className="bs-sub">{L({ en: 'New visits become leads on this board & group.', fr: 'Les visites deviennent des prospects sur ce tableau et ce groupe.' }, lang)}</div>
            <div className="bk-row">
              <div className="blank-field"><label>{L({ en: 'Board', fr: 'Tableau' }, lang)}</label>
                <div className="bf-control"><select className="bf-select" value={cfg.board} disabled={!!link} onChange={(e) => set('board', e.target.value)}>
                  <option value="">{L({ en: 'Select…', fr: 'Choisir…' }, lang)}</option>
                  {boards.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select><span className="bf-caret"><Icon name="chevronDown" size={15} /></span></div></div>
              <div className="blank-field"><label>{L({ en: 'Group', fr: 'Groupe' }, lang)}</label>
                <div className="bf-control"><select className="bf-select" value={cfg.group} onChange={(e) => set('group', e.target.value)}>
                  <option value="">{L({ en: 'Select…', fr: 'Choisir…' }, lang)}</option>
                  {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select><span className="bf-caret"><Icon name="chevronDown" size={15} /></span></div></div>
            </div>
          </div>

          <div className="bk-section">
            <h3><span className="bs-ic"><Icon name="form" size={15} /></span>{L({ en: 'Event details', fr: 'Détails de l’événement' }, lang)}</h3>
            <div className="blank-field"><label>{L({ en: 'Title', fr: 'Titre' }, lang)}</label><input className="bf-input" value={cfg.title} onChange={(e) => set('title', e.target.value)} /></div>
            <div className="bk-row">
              <div className="blank-field"><label>{L({ en: 'Duration', fr: 'Durée' }, lang)}</label>
                <div className="bf-control"><select className="bf-select" value={cfg.durationMinutes} onChange={(e) => set('durationMinutes', +e.target.value)}>{[15, 20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} min</option>)}</select><span className="bf-caret"><Icon name="chevronDown" size={15} /></span></div></div>
              <div className="blank-field"><label>{L({ en: 'Location', fr: 'Lieu' }, lang)}</label><input className="bf-input" value={cfg.location} onChange={(e) => set('location', e.target.value)} /></div>
            </div>
          </div>

          <div className="bk-section">
            <h3><span className="bs-ic"><Icon name="calendar" size={15} /></span>{L({ en: 'Availability', fr: 'Disponibilités' }, lang)}</h3>
            <div className="bs-sub">{L({ en: 'Tap the days you take visits.', fr: 'Touchez les jours où vous recevez.' }, lang)}</div>
            <div className="day-pills">
              {DAYS[lang].map((d, i) => (
                <button type="button" key={i} className={'day-pill' + (cfg.days[i] ? ' on' : '')} onClick={() => set('days', cfg.days.map((x, j) => (j === i ? !x : x)))}>{d}</button>
              ))}
            </div>
            <div className="time-range">
              <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{L({ en: 'From', fr: 'De' }, lang)}</span>
              <input className="bf-input" style={{ height: 40, width: 100 }} type="time" value={cfg.start} onChange={(e) => set('start', e.target.value)} />
              <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{L({ en: 'to', fr: 'à' }, lang)}</span>
              <input className="bf-input" style={{ height: 40, width: 100 }} type="time" value={cfg.end} onChange={(e) => set('end', e.target.value)} />
            </div>
          </div>

          <div className="bk-section">
            <h3><span className="bs-ic"><Icon name="users" size={15} /></span>{L({ en: 'Agent assignment', fr: 'Attribution d’agent' }, lang)}</h3>
            <div className="seg" style={{ marginBottom: 14 }}>
              <button type="button" className={cfg.assign === 'fixed' ? 'on' : ''} onClick={() => set('assign', 'fixed')}>{L({ en: 'Fixed agent', fr: 'Agent fixe' }, lang)}</button>
              <button type="button" className={cfg.assign === 'robin' ? 'on' : ''} onClick={() => set('assign', 'robin')}>{L({ en: 'Round-robin', fr: 'Rotation' }, lang)}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {members.map((m) => {
                const on = cfg.assign === 'robin' ? cfg.agents.includes(m._id) : cfg.agents[0] === m._id;
                return (
                  <button type="button" key={m._id} onClick={() => (cfg.assign === 'robin' ? toggleAgent(m._id) : set('agents', [m._id]))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 11px 5px 5px', borderRadius: 999, border: '1px solid', borderColor: on ? 'var(--book)' : 'var(--border)', background: on ? 'var(--book-tint)' : 'var(--surface)', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                    <MAvatar member={m} size={22} />{m.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bk-section">
            <h3><span className="bs-ic"><Icon name="palette" size={15} /></span>{L({ en: 'Branding', fr: 'Image de marque' }, lang)}</h3>
            <div className="blank-field"><label>{L({ en: 'Headline', fr: 'Titre d’accroche' }, lang)}</label><input className="bf-input" value={cfg.headline} onChange={(e) => set('headline', e.target.value)} /></div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 9 }}>{L({ en: 'Accent color', fr: 'Couleur d’accent' }, lang)}</label>
            <div className="color-swatches">
              {ACCENTS.map((a) => (
                <button type="button" key={a.id} className={'cswatch' + (cfg.accent === a.id ? ' on' : '')} style={{ background: `linear-gradient(140deg, ${a.c}, ${a.c2})`, color: a.c }} onClick={() => set('accent', a.id)} aria-label={a.id}>
                  {cfg.accent === a.id && <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#fff' }}><Icon name="check" size={15} stroke={3} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bk-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <span className="preview-live"><i />{L({ en: 'LIVE PREVIEW', fr: 'APERÇU EN DIRECT' }, lang)}</span>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPreviewFull(previewCfg)}><Icon name="eye" size={14} />{L({ en: 'Open full page', fr: 'Page complète' }, lang)}</button>
          </div>
          <div className="preview-frame">
            <div className="preview-bar">
              <span className="pb-dot" style={{ background: '#F2754B' }} /><span className="pb-dot" style={{ background: '#E0982E' }} /><span className="pb-dot" style={{ background: '#16A34A' }} />
              <span className="pb-url">{L({ en: 'your booking page', fr: 'votre page de réservation' }, lang)}</span>
            </div>
            <PublicBooking config={previewCfg} compact lang={lang} key={cfg.accent + cfg.durationMinutes} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPremium() {
  const { i18n } = useTranslation();
  const lang = i18n.language && i18n.language.startsWith('fr') ? 'fr' : 'en';
  const toastError = useToastStore((s) => s.error);
  const toastSuccess = useToastStore((s) => s.success);

  const currentOrg = useOrgStore((s) => s.currentOrg);
  const members = useOrgStore((s) => s.members);
  const fetchMembers = useOrgStore((s) => s.fetchMembers);
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [full, setFull] = useState(null);

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

  useEffect(() => {
    if (currentOrg?._id && (!members || members.length === 0)) fetchMembers(currentOrg._id).catch(() => {});
    load();
  }, [currentOrg?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (l) => { setEditing(l); setView('edit'); };
  const previewFor = (l) => ({ title: l.title, duration: l.durationMinutes, location: l.location, agent: members.find((m) => m._id === (l.agents || [])[0])?.name, accent: accentObj(l.branding?.accentColor).c, accent2: accentObj(l.branding?.accentColor).c2, logo: 'SI', org: 'Sommet Immobilier' });

  const toggleActive = async (l, v) => {
    setLinks((s) => s.map((x) => (x._id === l._id ? { ...x, active: v } : x)));
    try { await bookingService.updateBookingLink(l._id, { active: v }); } catch { load(); }
  };
  const remove = async (l) => {
    if (!window.confirm(L({ en: `Delete “${l.title}”?`, fr: `Supprimer « ${l.title} » ?` }, lang))) return;
    try { await bookingService.deleteBookingLink(l._id); setLinks((s) => s.filter((x) => x._id !== l._id)); }
    catch (err) { toastError(err?.response?.data?.error || L({ en: 'Could not delete', fr: 'Impossible de supprimer' }, lang)); }
  };

  const overlay = full && (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFull(null); }}>
      <div className="sheet" style={{ maxWidth: 880, overflow: 'hidden' }}><button type="button" className="sheet-close" onClick={() => setFull(null)} style={{ zIndex: 5 }}><Icon name="x" size={18} /></button><PublicBooking config={full} lang={lang} /></div>
    </div>
  );

  if (view === 'edit') {
    return (
      <PageWrapper>
        <BookingEditor link={editing} boards={boards} members={members} lang={lang}
          onClose={() => setView('list')} onSaved={() => { setView('list'); load(); }}
          onPreviewFull={(cfg) => setFull(cfg)} toastError={toastError} toastSuccess={toastSuccess} />
        {overlay}
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="page book">
        <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="page-eyebrow dm-book"><span className="pe-ic"><Icon name="calendar" size={13} /></span>{L({ en: 'Booking', fr: 'Réservations' }, lang)}</span>
            <h1 className="page-title">{L({ en: 'Booking links', fr: 'Liens de réservation' }, lang)}</h1>
            <p className="page-sub">{L({ en: 'Share a beautiful page and let clients book property tours themselves — visits land straight in your calendar.', fr: 'Partagez une belle page et laissez les clients réserver leurs visites — elles arrivent directement dans votre calendrier.' }, lang)}</p>
          </div>
          <button type="button" className="btn btn-primary" style={{ background: 'var(--book)', boxShadow: '0 2px 10px -2px var(--book)' }} onClick={() => openEdit(null)}><Icon name="plus" size={16} />{L({ en: 'New link', fr: 'Nouveau lien' }, lang)}</button>
        </div>

        {error && (
          <div className="nudge" style={{ background: 'var(--red-bg)', borderColor: 'rgba(220,38,38,.26)' }}>
            <span className="nd-ic" style={{ background: 'rgba(220,38,38,.16)', color: 'var(--red)' }}><Icon name="info" size={17} /></span>
            <div><div className="nd-t">{L({ en: 'Couldn’t load booking links', fr: 'Impossible de charger les liens' }, lang)}</div></div>
            <button type="button" className="nd-fix" style={{ background: 'var(--red)' }} onClick={load}><Icon name="refresh" size={14} />{L({ en: 'Retry', fr: 'Réessayer' }, lang)}</button>
          </div>
        )}

        {loading ? (
          <div className="link-grid">{Array.from({ length: 3 }).map((_, i) => <div className="link-card" key={i}><div className="sk" style={{ height: 96, borderRadius: 0 }} /><div className="link-body"><Sk w="70%" h={15} /><Sk w="100%" h={34} /><Sk w="100%" h={34} /></div></div>)}</div>
        ) : links.length === 0 ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px', gap: 6 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--book-tint)', color: 'var(--book-ink)', marginBottom: 10 }}><Icon name="calendar" size={28} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{L({ en: 'No booking links yet', fr: 'Aucun lien de réservation' }, lang)}</div>
            <div style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 360, textWrap: 'pretty' }}>{L({ en: 'Create your first link in a minute — pick a board, your hours, and share it.', fr: 'Créez votre premier lien en une minute — un tableau, vos heures, et partagez-le.' }, lang)}</div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 14, background: 'var(--book)' }} onClick={() => openEdit(null)}><Icon name="plus" size={15} />{L({ en: 'Create a link', fr: 'Créer un lien' }, lang)}</button>
          </div>
        ) : (
          <div className="link-grid">
            {links.map((l) => (
              <LinkCard key={l._id} link={l} members={members} lang={lang}
                onToggle={(v) => toggleActive(l, v)} onEdit={() => openEdit(l)}
                onOpen={() => (l.publicUrl ? window.open(l.publicUrl, '_blank') : setFull(previewFor(l)))}
                onDelete={() => remove(l)} />
            ))}
          </div>
        )}

        {overlay}
      </div>
    </PageWrapper>
  );
}
