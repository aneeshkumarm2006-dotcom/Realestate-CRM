/* ============================================================
   Edit Workflow — booking reminder editor (UI). Add-action
   dropdown + email editor modal with variable chips. Visual/
   clickable; sending backend is a follow-up.
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Clock, Mail, X } from 'lucide-react';
import BookingAppShell from '../../bookingapp/BookingAppShell';

const MAX = 5;
const ADD_OPTS = [
  { type: 'invitee', label: 'Send email to invitee', desc: 'Send an email to all invitees and guests of the event' },
  { type: 'host', label: 'Send email to host', desc: 'Send an email to the person hosting the event' },
  { type: 'someone', label: 'Send email to someone else', desc: 'Send an email to someone else', once: true },
  { type: 'text-invitee', label: 'Send text to invitee', desc: 'Send a text to all invitees of the event' },
  { type: 'text-host', label: 'Send text to host', desc: 'Send a text to the person hosting the event' },
];
const VARS = ['Invitee Full Name', 'Event Name', 'Event Time', 'Location', 'Invitee Email', 'Invitee Phone Number', 'Agent First Name', 'Questions And Answers'];

const V = ({ children, it }) => <span className={'vchip' + (it ? ' it' : '')}>{children}</span>;

function EmailModal({ action, onClose, onDone }) {
  const [varsOpen, setVarsOpen] = useState(false);
  const [extra, setExtra] = useState([]); // appended variable chips
  const toName = action.type === 'invitee' ? 'the invitee' : action.type === 'host' ? 'the host' : 'someone else';
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="modal-h"><h2>Edit: {action.label}</h2><button type="button" className="modal-x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="mail-meta">
            <span className="lbl">Email message</span>
            <span className="mail-from">From: <Mail size={14} color="#EA4335" /> bookings@sommet.ca</span>
          </div>
          <div className="mail-row">
            <span className="rk">To</span>
            {action.type === 'someone'
              ? <span className="to-chip">adil@sommet.ca <button type="button"><X size={12} /></button></span>
              : <span style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{toName} &amp; guests</span>}
          </div>
          <div className="mail-row" style={{ alignItems: 'flex-start' }}>
            <span className="rk" style={{ paddingTop: 2 }}>Subject</span>
            <div className="mail-subject" style={{ flex: 1, border: 'none', padding: 0 }}>
              📅 Reminder: Tour Tomorrow - <V>Invitee Full Name</V> (<V>Event Name</V>)
            </div>
          </div>
          <div className="mail-body">
            <p><b>Hi <V>Agent First Name</V>,</b></p>
            <p>This is a reminder that you have a property tour scheduled for tomorrow.</p>
            <p><b>Summary of Visit:</b></p>
            <ul>
              <li><b>Building:</b> <V>Event Name</V></li>
              <li><b>Lead Name:</b> <V>Invitee Full Name</V></li>
              <li><b>Time:</b> <V>Event Time</V></li>
              <li><b>Location:</b> <V>Location</V></li>
            </ul>
            <p><b>Preparation Checklist:</b></p>
            <ol>
              <li><b>Check the mode:</b> If the location is <V>Location</V> (Address), ensure the unit is staged and keys are ready. If it is <b>WhatsApp</b>, ensure your phone is fully charged.</li>
              <li><b>Review the lead:</b> <V>Invitee Full Name</V>’s specific interests: <V it>Questions And Answers</V></li>
              <li><b>Conflict check:</b> Please ensure no other personal appointments overlap this 40-minute block on your synced calendar.</li>
            </ol>
            <p><b>Contact Information:</b></p>
            <ul>
              <li><b>Email:</b> <V>Invitee Email</V></li>
              <li><b>Phone:</b> <V>Invitee Phone Number</V></li>
            </ul>
            <p>Best,<br /><b>Sommet Immobilier System</b></p>
            {extra.map((vn, i) => <p key={i}><V>{vn}</V></p>)}
          </div>
        </div>
        <div className="modal-foot" style={{ position: 'relative' }}>
          <button type="button" className="mf-template">Template: Custom <ChevronDown size={14} /></button>
          <button type="button" className="mf-vars" onClick={() => setVarsOpen((o) => !o)}><Plus size={14} />Variables</button>
          <div className="mf-spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onDone}>Done</button>
          {varsOpen && (
            <div className="dd-opts" style={{ position: 'absolute', bottom: 58, left: 120, width: 240, background: 'var(--surface)', zIndex: 5, maxHeight: 200, overflow: 'auto', boxShadow: 'var(--sh-pop)' }}>
              {VARS.map((vn) => (
                <div key={vn} className="dd-opt" onClick={() => { setExtra((e) => [...e, vn]); setVarsOpen(false); }}><b>{vn}</b></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AddActionDropdown({ actions, onPick, onClose }) {
  const usedSomeone = actions.some((a) => a.type === 'someone');
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dropdown" style={{ top: 220, left: '50%', transform: 'translateX(-50%)' }}>
        <h3>Add action</h3>
        <div className="dd-label">Do this</div>
        <div className="dd-select">Select… <ChevronUp size={16} /></div>
        <div className="dd-opts">
          {ADD_OPTS.map((o) => {
            const dis = o.once && usedSomeone;
            return (
              <div key={o.type} className={'dd-opt' + (dis ? ' disabled' : '')} onClick={() => !dis && onPick(o)}>
                <b>{o.label}</b> <span>{dis ? 'This action can only be used once per workflow.' : o.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function EditWorkflowPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('24 hrs Email reminder to the Lead and Adil for Dorchester');
  const [actions, setActions] = useState([
    { type: 'someone', label: 'Send email to someone else' },
    { type: 'invitee', label: 'Send email to invitee' },
  ]);
  const [addOpen, setAddOpen] = useState(false);
  const [mail, setMail] = useState(null); // { action, index }

  const pickAdd = (o) => {
    setAddOpen(false);
    if (o.type.startsWith('text')) setActions((a) => [...a, { type: o.type, label: o.label }]);
    else setMail({ action: { type: o.type, label: o.label }, index: -1 });
  };
  const mailDone = () => {
    if (mail && mail.index < 0) setActions((a) => [...a, mail.action]);
    setMail(null);
  };

  return (
    <BookingAppShell active="workflows">
      <a className="back" href="#" onClick={(e) => { e.preventDefault(); navigate('/booking-app/workflows'); }}><ChevronLeft size={16} />Back</a>
      <div className="editor-h"><h1>Edit your workflow</h1><div className="sub">Sommet Immobilier</div></div>

      <div className="ed-row">
        <div className="field"><label>Workflow name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Which event types will this apply to?</label><div className="selectbox">1 selected <ChevronDown size={16} /></div></div>
      </div>

      <div className="ed-card">
        <h2>When this happens</h2>
        <div className="inner-card">
          <div className="ic-l"><span className="ic-mail" style={{ background: '#EEF6FF', color: 'var(--blue)' }}><Clock size={20} /></span>24 hours before event starts</div>
          <a className="ic-link" href="#" onClick={(e) => e.preventDefault()}><Edit2 size={15} />Edit</a>
        </div>
      </div>

      <div className="ed-card">
        <h2>Do this</h2>
        <div>
          {actions.map((a, i) => (
            <div className="inner-card fadein" key={i}>
              <div className="ic-l"><span className="ic-mail"><Mail size={20} /></span>{a.label}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button type="button" className="ic-link edit" onClick={() => setMail({ action: a, index: i })}><Edit2 size={15} />Edit</button>
                <button type="button" className="ic-link del" onClick={() => setActions((s) => s.filter((_, j) => j !== i))}><Trash2 size={15} />Delete</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="add-action" onClick={() => actions.length < MAX && setAddOpen(true)}><Plus size={18} />Add action</button>
        <div className="actions-count">{actions.length}/{MAX} actions added</div>
      </div>

      <div className="ed-foot">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/booking-app/workflows')}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/booking-app/workflows')}>Save</button>
      </div>

      {addOpen && <AddActionDropdown actions={actions} onPick={pickAdd} onClose={() => setAddOpen(false)} />}
      {mail && <EmailModal action={mail.action} onClose={() => setMail(null)} onDone={mailDone} />}
    </BookingAppShell>
  );
}
