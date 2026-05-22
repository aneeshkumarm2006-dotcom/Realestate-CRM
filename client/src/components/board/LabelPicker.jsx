import { useEffect, useMemo, useRef } from 'react';
import { Settings as SettingsIcon, Check } from 'lucide-react';
import { getColorPair } from '../../utils/priorityColors';

/**
 * LabelPicker — popover anchored to a task's Labels cell. Shows every label
 * configured on the board as a toggleable chip; checked chips indicate the
 * label is currently applied to the task. An "Edit Labels" footer link
 * opens the EditChipsModal in label mode (admin only).
 *
 * Props:
 *   anchorEl    — DOM element the popover is anchored to
 *   board       — current board doc (reads board.labels)
 *   selectedIds — array of label ids currently applied to the task
 *   onToggle    — (labelId, nextChecked) => void
 *   onEditChips — optional: () => void — render an admin "Edit Labels" footer
 *   onClose     — () => void
 */
const LabelPicker = ({
  anchorEl,
  board,
  selectedIds = [],
  onToggle,
  onEditChips,
  onClose,
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [anchorEl, onClose]);

  const labels = useMemo(() => {
    if (!board || !Array.isArray(board.labels)) return [];
    return [...board.labels].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [board]);

  const selectedSet = useMemo(
    () => new Set((selectedIds || []).map((id) => id.toString())),
    [selectedIds]
  );

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const top = rect.bottom + 6;
  const left = rect.left;

  return (
    <div
      ref={ref}
      role="listbox"
      className="fixed bg-white"
      style={{
        top,
        left,
        zIndex: 60,
        minWidth: 220,
        maxWidth: 280,
        padding: 6,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        animation: 'macan-dropdown-enter 150ms ease-out',
      }}
    >
      {labels.length === 0 && (
        <p
          className="font-body text-center"
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            padding: '12px 8px',
          }}
        >
          No labels yet
        </p>
      )}
      {labels.map((label) => {
        const isSelected = selectedSet.has(label._id.toString());
        const pair = getColorPair(label.color);
        return (
          <button
            key={label._id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onToggle?.(label._id, !isSelected)}
            className="w-full flex items-center gap-2 text-left transition-opacity duration-150 hover:opacity-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            style={{
              margin: '2px 0',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: isSelected ? 'var(--color-bg-subtle)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              className="inline-flex items-center font-body font-medium"
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: pair.bg,
                color: pair.text,
                flex: 1,
                lineHeight: 1.2,
              }}
            >
              {label.name}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                color: isSelected
                  ? 'var(--color-accent)'
                  : 'var(--color-text-muted)',
                opacity: isSelected ? 1 : 0.25,
              }}
            >
              <Check size={14} />
            </span>
          </button>
        );
      })}
      {onEditChips && (
        <button
          type="button"
          onClick={onEditChips}
          className="w-full flex items-center gap-2 font-body transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          style={{
            marginTop: 6,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <SettingsIcon size={12} aria-hidden="true" />
          Edit Labels
        </button>
      )}
      <style>{`
        @keyframes macan-dropdown-enter {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LabelPicker;
