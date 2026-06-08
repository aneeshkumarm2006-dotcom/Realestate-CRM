/* ============================================================
   Public booking flow (used full-screen AND in the live preview).
   Month calendar → time slots → details → confirmation, with a
   live timezone control that regroups slot labels.
   Faithful port of the Claude Design handoff (booking-public.jsx).
   ============================================================ */
import { useState, Fragment } from 'react';
import Icon from './PremiumIcons';
import { L } from './premiumData';

export const TZS = [
  { id: 'et', label: { en: 'Montréal — Eastern (ET)', fr: 'Montréal — Est (HE)' }, short: 'ET', off: 0 },
  { id: 'pt', label: { en: 'Vancouver — Pacific (PT)', fr: 'Vancouver — Pacifique (HP)' }, short: 'PT', off: -3 },
  { id: 'at', label: { en: 'Halifax — Atlantic (AT)', fr: 'Halifax — Atlantique (HA)' }, short: 'AT', off: 1 },
  { id: 'ce', label: { en: 'Paris — Central Europe (CET)', fr: 'Paris — Europe centrale (CET)' }, short: 'CET', off: 6 },
];
const DOW = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], fr: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] };
const MON = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};
const fmtSlot = (mins, lang) => {
  const h = Math.floor(((((mins % 1440) + 1440) % 1440)) / 60); const m = ((mins % 60) + 60) % 60;
  if (lang === 'fr') return `${((h % 24) + 24) % 24}h${m.toString().padStart(2, '0')}`;
  const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ap}`;
};

export default function PublicBooking({ config, compact, lang, onDone }) {
  const c = config;
  const [step, setStep] = useState('date');
  const [monthOff, setMonthOff] = useState(0);
  const [sel, setSel] = useState(null);
  const [slot, setSlot] = useState(null);
  const [tz, setTz] = useState('et');
  const [tzOpen, setTzOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const tzObj = TZS.find((tt) => tt.id === tz);
  const baseY = 2026; const baseM = 5;
  const today = { y: 2026, m: 5, d: 9 };
  const cur = new Date(baseY, baseM + monthOff, 1);
  const Y = cur.getFullYear(); const M = cur.getMonth();
  const firstDow = new Date(Y, M, 1).getDay();
  const daysIn = new Date(Y, M + 1, 0).getDate();
  const isPast = (d) => (Y < today.y) || (Y === today.y && M < today.m) || (Y === today.y && M === today.m && d < today.d);
  const isAvail = (d) => { const wd = new Date(Y, M, d).getDay(); return wd >= 1 && wd <= 5 && !isPast(d); };

  const dur = c.duration || 30;
  const baseSlots = [];
  for (let tmin = 540; tmin + dur <= 1020; tmin += dur) baseSlots.push(tmin);

  const goSlot = (s) => { setSlot(s); setStep('details'); };
  const accentStyle = { '--acc': c.accent || 'var(--book)', '--acc2': c.accent2 || 'var(--book-2)' };

  const Steps = () => {
    const items = [['date', { en: 'Date', fr: 'Date' }], ['time', { en: 'Time', fr: 'Heure' }], ['details', { en: 'Details', fr: 'Détails' }]];
    const order = ['date', 'time', 'details', 'done'];
    return (
      <div className="pub-steps">
        {items.map(([k, lbl], i) => (
          <Fragment key={k}>
            <span className={'pub-step' + (step === k ? ' on' : '') + (order.indexOf(step) > order.indexOf(k) ? ' done' : '')}>
              <span className="ps-n">{order.indexOf(step) > order.indexOf(k) ? <Icon name="check" size={11} stroke={3} /> : i + 1}</span>{L(lbl, lang)}
            </span>
            {i < items.length - 1 && <span className="pub-step-sep" />}
          </Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className={'pub' + (compact ? ' compact' : '')} style={accentStyle}>
      <div className="pub-rail">
        <div className="pub-wash"><div className="pub-cover" />{c.cover && <div className="pub-cover" style={{ opacity: 0.5 }} />}</div>
        <div className="pub-logo">{c.logo || 'SI'}</div>
        <div className="pub-rail-body">
          <div className="pub-org">{c.org || 'Sommet Immobilier'}</div>
          <div className="pub-title">{c.title || L({ en: 'Private property tour', fr: 'Visite privée' }, lang)}</div>
          <div className="pub-meta">
            <div className="pm"><span className="pm-ic"><Icon name="user" size={compact ? 14 : 16} /></span>{c.agent || 'Camille Tremblay'}</div>
            <div className="pm"><span className="pm-ic"><Icon name="clock" size={compact ? 14 : 16} /></span>{dur} min</div>
            <div className="pm"><span className="pm-ic"><Icon name="mapPin" size={compact ? 14 : 16} /></span>{c.location || L({ en: 'On-site visit', fr: 'Visite sur place' }, lang)}</div>
          </div>
          {!compact && (
            <div className="pub-tz" style={{ position: 'relative' }}>
              <button type="button" className="tz-btn" onClick={() => setTzOpen((o) => !o)}>
                <Icon name="globe" size={15} /><span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{L(tzObj.label, lang)}</span><Icon name="chevronDown" size={14} />
              </button>
              {tzOpen && (
                <div className="pop" style={{ position: 'absolute', bottom: 46, left: 0, width: '100%', zIndex: 5 }}>
                  {TZS.map((tt) => (
                    <button type="button" key={tt.id} className={'pop-opt' + (tz === tt.id ? ' on' : '')} onClick={() => { setTz(tt.id); setTzOpen(false); }}>{L(tt.label, lang)}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pub-panel">
        {step !== 'done' && <Steps />}

        {step === 'date' && (
          <div className="cal">
            <div className="cal-head">
              <button type="button" className="cal-nav" onClick={() => setMonthOff((o) => Math.max(0, o - 1))} disabled={monthOff === 0} style={{ opacity: monthOff === 0 ? 0.35 : 1 }}><Icon name="chevronLeft" size={18} /></button>
              <span className="cm">{MON[lang][M]} {Y}</span>
              <button type="button" className="cal-nav" onClick={() => setMonthOff((o) => Math.min(2, o + 1))}><Icon name="chevronRight" size={18} /></button>
            </div>
            <div className="cal-grid">
              {DOW[lang].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
              {Array.from({ length: firstDow }).map((_, i) => <div key={'e' + i} className="cal-day empty" />)}
              {Array.from({ length: daysIn }).map((_, i) => {
                const d = i + 1; const avail = isAvail(d); const isToday = Y === today.y && M === today.m && d === today.d;
                const isSel = sel && sel.y === Y && sel.m === M && sel.d === d;
                return (
                  <div key={d} className={'cal-day' + (avail ? ' avail' : isPast(d) || !avail ? ' disabled' : '') + (isToday ? ' today' : '') + (isSel ? ' sel' : '')}
                    onClick={avail ? () => { setSel({ y: Y, m: M, d }); setStep('time'); } : undefined}>
                    {d}{avail && <span className="cd-dot" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'time' && (
          <div className="cols-2">
            <div>
              <button type="button" className="tz-btn" style={{ width: 'auto', marginBottom: 14 }} onClick={() => setStep('date')}><Icon name="arrowLeft" size={14} />{L({ en: 'Change date', fr: 'Changer la date' }, lang)}</button>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{DOW[lang][new Date(sel.y, sel.m, sel.d).getDay()]} {sel.d} {MON[lang][sel.m]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{L({ en: 'Times shown in', fr: 'Heures en' }, lang)} {tzObj.short}</div>
            </div>
            <div className="col-r">
              <div className="slots-wrap">
                {baseSlots.map((s) => {
                  const disp = s + tzObj.off * 60;
                  return <button type="button" key={s} className={'slot' + (slot === s ? ' sel' : '')} onClick={() => goSlot(s)}>{fmtSlot(disp, lang)}</button>;
                })}
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div style={{ maxWidth: 420 }}>
            <button type="button" className="tz-btn" style={{ width: 'auto', marginBottom: 16 }} onClick={() => setStep('time')}><Icon name="arrowLeft" size={14} />{L({ en: 'Back', fr: 'Retour' }, lang)}</button>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{L({ en: 'Almost there', fr: 'Presque fini' }, lang)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 18 }}>{DOW[lang][new Date(sel.y, sel.m, sel.d).getDay()]} {sel.d} {MON[lang][sel.m]} · {fmtSlot(slot + tzObj.off * 60, lang)} {tzObj.short}</div>
            {[['name', { en: 'Full name', fr: 'Nom complet' }], ['email', { en: 'Email', fr: 'Courriel' }], ['phone', { en: 'Phone', fr: 'Téléphone' }]].map(([k, lbl]) => (
              <div className="flabel" key={k}>
                <input id={'f-' + k} placeholder=" " value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                <label htmlFor={'f-' + k}>{L(lbl, lang)}</label>
              </div>
            ))}
            <button type="button" className="btn btn-primary" style={{ width: '100%', height: 48, background: 'linear-gradient(135deg, var(--acc), var(--acc2))', boxShadow: '0 6px 18px -6px var(--acc)', marginTop: 4 }} onClick={() => setStep('done')}>
              <Icon name="check" size={16} stroke={3} />{L({ en: 'Confirm booking', fr: 'Confirmer la réservation' }, lang)}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: compact ? '10px' : '20px 0' }}>
            <div className="burst-ring" style={{ width: 64, height: 64, marginBottom: 18, background: 'linear-gradient(135deg, var(--acc), var(--acc2))' }}><Icon name="check" size={32} stroke={3} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, marginBottom: 6 }}>{L({ en: 'You’re booked!', fr: 'C’est réservé !' }, lang)}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 20, textAlign: 'center' }}>{L({ en: 'A confirmation is on its way to your inbox.', fr: 'Une confirmation s’en vient dans votre boîte.' }, lang)}</div>
            <div className="ticket">
              <div className="ticket-top"><div className="tt-title">{c.title || L({ en: 'Private property tour', fr: 'Visite privée' }, lang)}</div>
                <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{c.org || 'Sommet Immobilier'}</div></div>
              <div className="ticket-perf" />
              <div className="ticket-body">
                <div className="ticket-row"><span className="tr-ic"><Icon name="calendar" size={15} /></span><div><div className="tr-l">{L({ en: 'When', fr: 'Quand' }, lang)}</div><div className="tr-v">{sel && `${DOW[lang][new Date(sel.y, sel.m, sel.d).getDay()]} ${sel.d} ${MON[lang][sel.m]}`} · {fmtSlot((slot || 540) + tzObj.off * 60, lang)} {tzObj.short}</div></div></div>
                <div className="ticket-row"><span className="tr-ic"><Icon name="user" size={15} /></span><div><div className="tr-l">{L({ en: 'With', fr: 'Avec' }, lang)}</div><div className="tr-v">{c.agent || 'Camille Tremblay'}</div></div></div>
                <div className="ticket-row"><span className="tr-ic"><Icon name="mapPin" size={15} /></span><div><div className="tr-l">{L({ en: 'Where', fr: 'Où' }, lang)}</div><div className="tr-v">{c.location || L({ en: 'On-site visit', fr: 'Visite sur place' }, lang)}</div></div></div>
              </div>
            </div>
            {!compact && (
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-ghost btn-sm"><Icon name="download" size={14} />{L({ en: 'Add to calendar', fr: 'Ajouter au calendrier' }, lang)}</button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => { setStep('date'); setSel(null); setSlot(null); onDone && onDone(); }}>{L({ en: 'Reschedule', fr: 'Replanifier' }, lang)}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
