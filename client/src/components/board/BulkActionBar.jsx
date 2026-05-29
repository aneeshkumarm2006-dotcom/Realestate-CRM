import { forwardRef, useEffect, useRef, useState } from 'react';
import { Trash2, FolderInput, X, ChevronDown } from 'lucide-react';

/**
 * BulkActionBar — floating bottom-center toolbar shown when one or more
 * tasks are ticked anywhere on the board. Exposes:
 *   - Move to group (popover with the board's groups)
 *   - Delete (parent owns the confirm modal)
 *   - Clear selection
 *
 * Selection state lives on BoardDetailPage so this bar can aggregate ticks
 * across every group's TaskTable. The bar itself is presentational — all
 * mutations are dispatched via the props.
 *
 * Props:
 *   count          — number of selected task IDs
 *   groups         — board groups (used to populate the move-to-group menu)
 *   onMoveToGroup  — (groupId) => void
 *   onDelete       — () => void (parent shows confirmation)
 *   onClear        — () => void
 *   busy           — disables actions while a bulk operation is in flight
 */
const BulkActionBar = ({
  count = 0,
  groups = [],
  onMoveToGroup,
  onDelete,
  onClear,
  busy = false,
}) => {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveBtnRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!moveOpen) return undefined;
    const handleClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (moveBtnRef.current?.contains(e.target)) return;
      setMoveOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setMoveOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [moveOpen]);

  if (count <= 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${count} selected ${count === 1 ? 'task' : 'tasks'}`}
      className="fixed left-1/2 flex items-center font-body"
      style={{
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 70,
        background: 'var(--color-text-primary)',
        color: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.18))',
        padding: '6px 6px 6px 16px',
        gap: 6,
        animation: 'macan-bulkbar-enter 180ms ease-out',
      }}
    >
      <span
        aria-live="polite"
        style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}
      >
        {count} selected
      </span>

      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: 22,
          background: 'rgba(255,255,255,0.18)',
          marginRight: 2,
        }}
      />

      <div style={{ position: 'relative' }}>
        <BarButton
          ref={moveBtnRef}
          icon={FolderInput}
          label="Move to"
          trailing={ChevronDown}
          disabled={busy || groups.length === 0}
          onClick={() => setMoveOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={moveOpen}
        />
        {moveOpen && (
          <div
            ref={popoverRef}
            role="menu"
            aria-label="Move selected tasks to group"
            className="bg-white"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              minWidth: 200,
              maxHeight: 280,
              overflowY: 'auto',
              padding: 4,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              color: 'var(--color-text-primary)',
              animation: 'macan-bulkbar-popover-enter 140ms ease-out',
            }}
          >
            {groups.length === 0 ? (
              <p
                style={{
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                }}
              >
                No other groups available
              </p>
            ) : (
              groups.map((g) => (
                <button
                  key={g._id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoveOpen(false);
                    onMoveToGroup?.(g._id);
                  }}
                  className="w-full text-left transition-colors duration-100 hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus:bg-[color:var(--color-bg-subtle)]"
                  style={{
                    padding: '8px 10px',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {g.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <BarButton
        icon={Trash2}
        label="Delete"
        disabled={busy}
        onClick={onDelete}
        danger
      />

      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: 22,
          background: 'rgba(255,255,255,0.18)',
          marginLeft: 2,
        }}
      />

      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        aria-label="Clear selection"
        title="Clear selection"
        className="flex items-center justify-center transition-colors duration-150 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          width: 32,
          height: 32,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: '#FFFFFF',
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>

      <style>{`
        @keyframes macan-bulkbar-enter {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes macan-bulkbar-popover-enter {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/**
 * Pill-style button used inside the dark bar. forwardRef so the Move-to
 * button can be used as a popover anchor.
 */
const BarButton = forwardRef(function BarButton(
  {
    icon: Icon,
    trailing: Trailing,
    label,
    onClick,
    disabled = false,
    danger = false,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        height: 32,
        padding: '0 12px',
        fontSize: 13,
        fontWeight: 600,
        background: 'transparent',
        color: danger ? '#FCA5A5' : '#FFFFFF',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
      }}
      {...rest}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      <span>{label}</span>
      {Trailing && <Trailing size={12} aria-hidden="true" />}
    </button>
  );
});

export default BulkActionBar;
