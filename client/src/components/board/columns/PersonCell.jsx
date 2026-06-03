import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cellWrapperStyle } from './cellShared';
import useOrgStore from '../../../store/orgStore';

/**
 * PersonCell — multi-select picker over the current org's members. Shows
 * stacked initials chips when collapsed; opens a checklist when clicked.
 *
 * The picker renders through a React portal with fixed positioning so it is
 * never clipped by the DataGrid's scroll container or the group card.
 */
const PersonCell = ({ value, readOnly, onChange }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const members = useOrgStore((s) => s.members || []);
  const selected = Array.isArray(value) ? value.map((v) => v.toString()) : [];

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Position the portal popover relative to the trigger, flipping upward when
  // there isn't enough room below.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const compute = () => {
      const r = triggerRef.current.getBoundingClientRect();
      const ph = popRef.current?.offsetHeight || 280;
      const up = window.innerHeight - r.bottom < ph + 8 && r.top > ph + 8;
      setPos({
        top: up ? Math.max(8, r.top - ph - 6) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
      });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  const toggle = (id) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange?.(Array.from(set));
  };

  const initials = (name) =>
    (name || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div ref={triggerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{ ...cellWrapperStyle, gap: 4, cursor: readOnly ? 'default' : 'pointer' }}
        onClick={() => !readOnly && setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        ) : (
          selected.slice(0, 4).map((id) => {
            const member = members.find((m) => (m._id || m.id || '').toString() === id);
            return (
              <span
                key={id}
                title={member?.name || id}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  marginRight: -6,
                  border: '1.5px solid var(--color-bg-elevated)',
                }}
              >
                {initials(member?.name)}
              </span>
            );
          })
        )}
        {selected.length > 4 && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            +{selected.length - 4}
          </span>
        )}
      </div>

      {open && !readOnly && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 220,
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 200,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            padding: 6,
          }}
        >
          {members.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              No members
            </div>
          ) : (
            members.map((m) => {
              const id = (m._id || m.id || '').toString();
              const checked = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 13,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {initials(m.name)}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{m.name}</span>
                  {checked && <Check size={14} aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PersonCell;
