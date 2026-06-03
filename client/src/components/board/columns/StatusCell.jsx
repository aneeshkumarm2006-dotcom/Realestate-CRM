import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cellWrapperStyle, optionSorted, findOption } from './cellShared';
import { getColorPair } from '../../../utils/priorityColors';
import CellPlaceholder from './CellPlaceholder';

/**
 * StatusCell — renders the selected option as a coloured chip. Clicking
 * opens a popover listing every configured option.
 *
 * The options popover renders through a React portal with fixed positioning
 * (mirroring DatePickerPopover) so it is never clipped by the DataGrid's
 * horizontal scroll container or the group card's `overflow-hidden`.
 */
const StatusCell = ({ value, column, readOnly, onChange }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const options = optionSorted(column?.settings?.options);
  const selected = findOption(options, value);

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
      const ph = popRef.current?.offsetHeight || 220;
      const up = window.innerHeight - r.bottom < ph + 8 && r.top > ph + 8;
      setPos({
        top: up ? Math.max(8, r.top - ph - 6) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 200)),
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

  const chip = (label, color) => {
    const pair = getColorPair(color);
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 500,
          color: pair.text,
          background: pair.bg,
          borderRadius: 'var(--radius-full)',
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div ref={triggerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{ ...cellWrapperStyle, cursor: readOnly ? 'default' : 'pointer' }}
        onClick={() => !readOnly && setOpen((v) => !v)}
      >
        {selected ? chip(selected.label, selected.color) : (
          !readOnly && (
            <CellPlaceholder text={column?.type === 'dropdown' ? 'Select' : 'Set status'} />
          )
        )}
      </div>
      {open && !readOnly && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 180,
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
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange?.(opt.id);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                margin: '2px 0',
                padding: '6px 8px',
                fontSize: 12,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {chip(opt.label, opt.color)}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange?.(null);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '6px 8px',
                fontSize: 11,
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid var(--color-border)',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                textAlign: 'left',
              }}
            >
              Clear
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default StatusCell;
