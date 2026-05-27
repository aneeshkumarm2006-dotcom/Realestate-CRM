import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import AssigneePicker from './AssigneePicker';
import { PRIORITY_COLORS, STATUS_COLORS } from '../../utils/priorityColors';

const sameStringSet = (a, b) => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
};

/**
 * TaskEditRow — inline editable row used for both creating and editing
 * a task within a group's TaskTable.
 *
 * The Status dropdown reads its options from the board's `statuses` array
 * when a board is passed in (post Phase 2). Falls back to the legacy 4-enum
 * options if no board is provided (kept for safety / personal task lists).
 *
 * Props:
 *   board        — board doc with `statuses[]`
 *   members      — org members ({ _id, name, profilePic })
 *   initialTask  — optional existing task (for edit mode)
 *   onSave       — async (payload) => void
 *   onCancel     — () => void
 *   isLast       — removes bottom border when this is the last row
 */
const PRIORITY_OPTIONS = Object.entries(PRIORITY_COLORS).map(([v, e]) => ({
  value: v,
  label: e.label,
}));
const LEGACY_STATUS_OPTIONS = Object.entries(STATUS_COLORS).map(([v, e]) => ({
  value: v,
  label: e.label,
}));

const toDateInputValue = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TaskEditRow = ({
  board = null,
  members = [],
  initialTask = null,
  onSave,
  onCancel,
  isLast = false,
  isAdmin = false,
  autoFocus = true,
}) => {
  const statusOptions = useMemo(() => {
    if (board && Array.isArray(board.statuses) && board.statuses.length > 0) {
      return [...board.statuses]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((s) => ({ value: s._id, label: s.name }));
    }
    return LEGACY_STATUS_OPTIONS;
  }, [board]);

  // Resolve initial status. If the task has one, normalise to string so the
  // Dropdown can compare against `value`.
  const initialStatus = useMemo(() => {
    if (initialTask?.status) return initialTask.status.toString();
    if (statusOptions.length > 0) return statusOptions[0].value.toString();
    return 'not_started';
  }, [initialTask, statusOptions]);

  const [name, setName] = useState(initialTask?.name || '');
  const [priority, setPriority] = useState(initialTask?.priority || 'medium');
  const [status, setStatus] = useState(initialStatus);
  const [assignedTo, setAssignedTo] = useState(() => {
    const raw = initialTask?.assignedTo || [];
    return raw.map((u) => (typeof u === 'string' ? u : u._id));
  });
  const [dueDate, setDueDate] = useState(() =>
    toDateInputValue(initialTask?.dueDate)
  );
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const nameInputRef = useRef(null);
  const statusCellRef = useRef(null);

  useEffect(() => {
    if (autoFocus) nameInputRef.current?.focus();
  }, [autoFocus]);

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setStatusError('');

    const trimmedName = name.trim();
    const isoDue = dueDate ? new Date(dueDate).toISOString() : null;

    let payload;
    if (!initialTask) {
      payload = {
        name: trimmedName,
        priority,
        status,
        assignedTo,
        dueDate: isoDue,
        sendEmailNotification: true,
      };
    } else {
      payload = {};
      if (trimmedName !== (initialTask.name || '')) payload.name = trimmedName;
      if (priority !== (initialTask.priority || 'medium')) payload.priority = priority;
      if (status !== initialStatus) payload.status = status;

      const prevAssignees = (initialTask.assignedTo || []).map((u) =>
        typeof u === 'string' ? u : u._id
      );
      if (!sameStringSet(prevAssignees, assignedTo)) payload.assignedTo = assignedTo;

      const prevIso = initialTask.dueDate ? new Date(initialTask.dueDate).toISOString() : null;
      if (isoDue !== prevIso) payload.dueDate = isoDue;

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        onCancel?.();
        return;
      }
      payload.sendEmailNotification = true;
    }

    try {
      await onSave?.(payload);
    } catch (err) {
      setSaving(false);
      const data = err?.response?.data;
      if (data?.field === 'status') {
        setStatusError(data.error || 'Invalid status for this board');
        if (statusCellRef.current) {
          statusCellRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  };

  const handleCancel = () => {
    if (!initialTask) {
      setName('');
      setPriority('medium');
      setStatus(initialStatus);
      setAssignedTo([]);
      setDueDate('');
    } else {
      onCancel?.();
    }
  };

  const handleKeyDown = (e) => {
    if (e.target.closest('[role="listbox"]') || e.target.closest('[role="option"]')) {
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const mainRowBorder = isLast ? 'none' : '1px solid var(--color-border)';

  return (
    <>
    <tr
      style={{
        height: 56,
        borderBottom: mainRowBorder,
        background: 'var(--color-bg-subtle)',
      }}
      onKeyDown={handleKeyDown}
    >
      <td style={{ width: 40, padding: '0 0 0 16px' }} />

      <td style={{ padding: '0 16px', minWidth: 240 }}>
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name…"
          aria-label="Task name"
          className="w-full font-body bg-white focus:outline-none"
          style={{
            fontSize: 14,
            height: 32,
            padding: '0 10px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = '1.5px solid var(--color-accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1.5px solid var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </td>

      <td style={{ width: 130, padding: '0 8px' }}>
        <Dropdown
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
          size="sm"
        />
      </td>

      <td
        ref={statusCellRef}
        style={{
          width: 160,
          padding: '0 8px',
          outline: statusError
            ? '2px solid var(--color-status-stuck)'
            : 'none',
          outlineOffset: -2,
          borderRadius: 'var(--radius-md)',
          transition: 'outline-color 150ms ease-in-out',
        }}
        title={statusError || undefined}
      >
        <Dropdown
          options={statusOptions}
          value={status}
          onChange={(val) => {
            setStatusError('');
            setStatus(val.toString());
          }}
          size="sm"
        />
      </td>

      {/* Labels column placeholder — edited from the comment panel / picker */}
      <td style={{ width: 180, padding: '0 8px' }}>
        <span
          className="font-body"
          style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
        >
          —
        </span>
      </td>

      <td style={{ width: 160, padding: '0 8px' }}>
        <AssigneePicker
          members={members}
          value={assignedTo}
          onChange={setAssignedTo}
          isAdmin={isAdmin}
        />
      </td>

      <td style={{ width: 140, padding: '0 8px' }}>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
          className="w-full font-body bg-white focus:outline-none"
          style={{
            fontSize: 13,
            height: 32,
            padding: '0 8px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
          }}
        />
      </td>

      <td style={{ width: 48 }} />

      <td style={{ width: 72, padding: '0 8px 0 0' }}>
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            aria-label="Save task"
            className="flex items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              width: 28,
              height: 28,
              background: 'var(--color-accent)',
              color: '#FFFFFF',
              border: 'none',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel"
            className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: '1.5px solid var(--color-border-strong)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
    </>
  );
};

export default TaskEditRow;
