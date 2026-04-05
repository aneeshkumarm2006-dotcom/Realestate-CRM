import { useEffect, useRef } from 'react';
import { STATUS_COLORS } from '../../utils/priorityColors';

/**
 * StatusMenu — small popover menu anchored to a status chip.
 *
 * Opens when a user clicks a status chip on a task row. Renders the four
 * status options as chip-styled buttons. Selecting one calls onSelect
 * with the new status key. Clicks outside / Escape close the menu.
 *
 * Props:
 *   anchorEl — DOM element the menu is anchored to (for positioning)
 *   value    — currently selected status key
 *   onSelect — (newStatus) => void
 *   onClose  — () => void
 */
const STATUS_ORDER = ['not_started', 'working_on_it', 'done', 'stuck'];

const StatusMenu = ({ anchorEl, value, onSelect, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
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

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const top = rect.bottom + 6;
  const left = rect.left;

  return (
    <div
      ref={menuRef}
      role="listbox"
      className="fixed bg-white"
      style={{
        top,
        left,
        zIndex: 60,
        minWidth: 160,
        padding: 6,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        animation: 'macan-dropdown-enter 150ms ease-out',
      }}
    >
      {STATUS_ORDER.map((key) => {
        const entry = STATUS_COLORS[key];
        const isSelected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect?.(key)}
            className={[
              'w-full flex items-center text-left font-body font-medium',
              'transition-opacity duration-150 hover:opacity-90',
              'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]',
            ].join(' ')}
            style={{
              margin: '2px 0',
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 'var(--radius-full)',
              backgroundColor: entry.bg,
              color: entry.text,
              outline: isSelected
                ? '2px solid var(--color-accent)'
                : 'none',
              outlineOffset: isSelected ? 1 : 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {entry.label}
          </button>
        );
      })}
      <style>{`
        @keyframes macan-dropdown-enter {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default StatusMenu;
