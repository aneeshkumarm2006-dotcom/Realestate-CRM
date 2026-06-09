/* ============================================================
   Edit Workflow — booking reminder editor. WIRED to real
   BookingWorkflow CRUD: event-type multiselect, trigger picker,
   editable email actions (subject/body with {{variables}}).
   ============================================================ */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Plus, Edit2, Trash2, Clock, Mail, X, Check } from 'lucide-react';
import BookingAppShell from '../../bookingapp/BookingAppShell';
import * as bookingService from '../../services/bookingService';
import useBoardStore from '../../store/boardStore';
import useOrgStore from '../../store/orgStore';
import useToastStore from '../../store/toastStore';

const VARS = ['Invitee Full Name', 'Event Name', 'Event Time', 'Location', 'Invitee Email', 'Invitee Phone Number', 'Agent First Name', 'Questions And Answers'];
const ADD_OPTS = [
  { type: 'email_invitee', label: 'Send email to invitee', desc: 'Email all invitees of the event' },
  { type: 'email_host', label: 'Send email to host (agent)', desc: 'Email the agent assigned to the visit' },
  { type: 'email_other', label: 'Send email to someone else', desc: 'Email a fixed address you choose' },
];
const actionLabel = (type) => ADD_OPTS.find((o) => o.type === type)?.label || 'Send email';

const TRIGGERS = [
  { value: 'on_booking', label: 'Immediately when new event is booked', triggerType: 'on_booking', beforeMinutes: 0 },
  { value: 'before_1440', label: '24 hours before event starts', triggerType: 'before_event', beforeMinutes: 1440 },
  { value: 'before_120', label: '2 hours before event starts', triggerType: 'before_event', beforeMinutes: 120 },
  { value: 'before_60', label: '1 hour before event starts', triggerType: 'before_event', beforeMinutes: 60 },
];
const triggerValue = (triggerType, beforeMinutes) => (triggerType === 'on_booking' ? 'on_booking' : `before_${beforeMinutes}`);

const DEFAULT_BODY = `Hi {{Invitee Full Name}},

This is a reminder about your upcoming property tour.

• Event: {{Event Name}}
• When: {{Event Time}}
• Location: {{Location}}

If anything changes, just reply to this email.

Best,
{{Agent First Name}} — Sommet Immobilier`;

function EmailModal({ action, onClose, onSave }) {
  const [type] = useState(action.type);
  const [recipientEmail, setRecipientEmail] = useState(action.recipientEmail || '');
  const [subject, setSubject] = useState(action.subject || 'Reminder: {{Event Name}} tour');
  const [body, setBody] = useState(action.body || DEFAULT_BODY);
  const [varsOpen, setVarsOpen] = useState(false);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="modal-h"><h2>Edit: {actionLabel(type)}</h2><button type="button" className="modal-x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="mail-meta"><span className="lbl">Email message</span><span className="mail-from">From: <Mail size={14} color="#EA4335" /> your connected mailbox</span></div>
          <div className="mail-row">
            <span className="rk">To</span>
            {type === 'email_other'
              ? <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@email.com" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14 }} />
              : <span style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{type === 'email_host' ? 'the assigned agent' : 'the invitee'}</span>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '14px 0 6px' }}>Subject</div>
          <input className="mail-subject" style={{ width: '100%', border: '1px solid var(--border)' }} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '14px 0 6px' }}>Body</div>
          <textarea id="wf-body" className="mail-body" style={{ width: '100%', fontFamily: 'var(--font-b)', resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="modal-foot" style={{ position: 'relative' }}>
          <button type="button" className="mf-vars" onClick={() => setVarsOpen((o) => !o)}><Plus size={14} />Variables</button>
          <div className="mf-spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave({ type, recipientEmail, subject, body })}>Done</button>
          {varsOpen && (
            <div className="dd-opts" style={{ position: 'absolute', bottom: 58, left: 16, width: 240, background: 'var(--surface)', zIndex: 5, maxHeight: 220, overflow: 'auto', boxShadow: 'var(--sh-pop)' }}>
              {VARS.map((vn) => (
                <div key={vn} className="dd-opt" onClick={() => { setBody((b) => `${b} {{${vn}}}`); setVarsOpen(false); }}><b>{vn}</b></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function EditWorkflowPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const toastError = useToastStore((s) => s.error);
  const toastSuccess = useToastStore((s) => s.success);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [links, setLinks] = useState([]); // selected booking link ids
  const [triggerType, setTriggerType] = useState('before_event');
  const [beforeMinutes, setBeforeMinutes] = useState(1440);
  const [actions, setActions] = useState([]);
  const [eventTypes, setEventTypes] = useState([]); // [{_id,title}]
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mail, setMail] = useState(null); // { action, index }

  const load = useCallback(async () => {
    if (!currentOrg?._id) return;
    setLoading(true);
    try {
      const bs = boards.length ? boards : await fetchBoards(currentOrg._id);
      const per = await Promise.all((bs || []).map((b) => bookingService.listBookingLinks(b._id).catch(() => [])));
      setEventTypes(per.flat().map((l) => ({ _id: l._id, title: l.title })));
      if (id) {
        const wf = await bookingService.getBookingWorkflow(id);
        setName(wf.name || '');
        setLinks((wf.links || []).map((l) => (l._id ? l._id : l)));
        setTriggerType(wf.triggerType || 'before_event');
        setBeforeMinutes(wf.beforeMinutes ?? 1440);
        setActions(wf.actions || []);
      } else {
        setName('New reminder workflow');
      }
    } catch {
      toastError('Could not load the workflow');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?._id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const toggleLink = (lid) => setLinks((s) => (s.includes(lid) ? s.filter((x) => x !== lid) : [...s, lid]));
  const linksLabel = links.length === 0 ? 'All event types' : `${links.length} selected`;

  const setTrigger = (val) => { const o = TRIGGERS.find((x) => x.value === val) || TRIGGERS[0]; setTriggerType(o.triggerType); setBeforeMinutes(o.beforeMinutes); };

  const save = async () => {
    if (!name.trim()) { toastError('A workflow name is required'); return; }
    setSaving(true);
    const payload = { org: currentOrg._id, name: name.trim(), links, triggerType, beforeMinutes, actions, enabled: true };
    try {
      if (id) await bookingService.updateBookingWorkflow(id, payload);
      else await bookingService.createBookingWorkflow(payload);
      toastSuccess('Workflow saved');
      navigate('/booking-app/workflows');
    } catch (err) {
      toastError(err?.response?.data?.error || 'Could not save the workflow');
    } finally { setSaving(false); }
  };

  return (
    <BookingAppShell active="workflows">
      <a className="back" href="#" onClick={(e) => { e.preventDefault(); navigate('/booking-app/workflows'); }}><ChevronLeft size={16} />Back</a>
      <div className="editor-h"><h1>{id ? 'Edit your workflow' : 'New workflow'}</h1><div className="sub">{currentOrg?.name || 'Sommet Immobilier'}</div></div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>Loading…</div>
      ) : (
        <>
          <div className="ed-row">
            <div className="field"><label>Workflow name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field" style={{ position: 'relative' }}>
              <label>Which event types will this apply to?</label>
              <div className="selectbox" onClick={() => setLinkPickerOpen((o) => !o)}>{linksLabel} <ChevronDown size={16} /></div>
              {linkPickerOpen && (
                <div className="dd-opts" style={{ position: 'absolute', top: 78, left: 0, right: 0, zIndex: 6, background: 'var(--surface)', maxHeight: 240, overflow: 'auto', boxShadow: 'var(--sh-pop)' }}>
                  {eventTypes.length === 0 && <div className="dd-opt" style={{ color: 'var(--muted)' }}>No event types yet</div>}
                  {eventTypes.map((et) => (
                    <div key={et._id} className="dd-opt" onClick={() => toggleLink(et._id)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--border-2)', display: 'grid', placeItems: 'center', background: links.includes(et._id) ? 'var(--blue)' : 'transparent', borderColor: links.includes(et._id) ? 'var(--blue)' : 'var(--border-2)' }}>
                        {links.includes(et._id) && <Check size={12} color="#fff" />}
                      </span>
                      <b style={{ fontWeight: 500 }}>{et.title}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ed-card">
            <h2>When this happens</h2>
            <div className="inner-card">
              <div className="ic-l"><span className="ic-mail" style={{ background: '#EEF6FF', color: 'var(--blue)' }}><Clock size={20} /></span>
                <div className="bf-control" style={{ position: 'relative' }}>
                  <select className="bf-select" style={{ height: 42, minWidth: 320, border: '1px solid var(--border-2)', borderRadius: 8, padding: '0 36px 0 12px', appearance: 'none', background: 'var(--surface)', fontSize: 14.5, cursor: 'pointer' }}
                    value={triggerValue(triggerType, beforeMinutes)} onChange={(e) => setTrigger(e.target.value)}>
                    {TRIGGERS.map((tg) => <option key={tg.value} value={tg.value}>{tg.label}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }}><ChevronDown size={15} /></span>
                </div>
              </div>
            </div>
          </div>

          <div className="ed-card">
            <h2>Do this</h2>
            <div>
              {actions.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--muted)', padding: '4px 2px 8px' }}>No actions yet — add an email below.</div>}
              {actions.map((a, i) => (
                <div className="inner-card fadein" key={i}>
                  <div className="ic-l"><span className="ic-mail"><Mail size={20} /></span>{actionLabel(a.type)}{a.type === 'email_other' && a.recipientEmail ? ` → ${a.recipientEmail}` : ''}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <button type="button" className="ic-link edit" onClick={() => setMail({ action: a, index: i })}><Edit2 size={15} />Edit</button>
                    <button type="button" className="ic-link del" onClick={() => setActions((s) => s.filter((_, j) => j !== i))}><Trash2 size={15} />Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="add-action" onClick={() => setAddOpen(true)}><Plus size={18} />Add action</button>
          </div>

          <div className="ed-foot">
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/booking-app/workflows')}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}

      {addOpen && (
        <>
          <div className="scrim" onClick={() => setAddOpen(false)} />
          <div className="dropdown" style={{ top: 220, left: '50%', transform: 'translateX(-50%)' }}>
            <h3>Add action</h3>
            <div className="dd-label">Do this</div>
            <div className="dd-opts">
              {ADD_OPTS.map((o) => (
                <div key={o.type} className="dd-opt" onClick={() => { setAddOpen(false); setMail({ action: { type: o.type, recipientEmail: '', subject: '', body: '' }, index: -1 }); }}>
                  <b>{o.label}</b> <span>{o.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {mail && (
        <EmailModal
          action={mail.action}
          onClose={() => setMail(null)}
          onSave={(updated) => {
            setActions((s) => (mail.index < 0 ? [...s, updated] : s.map((x, j) => (j === mail.index ? updated : x))));
            setMail(null);
          }}
        />
      )}
    </BookingAppShell>
  );
}
