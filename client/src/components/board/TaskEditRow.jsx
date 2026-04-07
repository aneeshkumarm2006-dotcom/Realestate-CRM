import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import AssigneePicker from './AssigneePicker';
import { PRIORITY_COLORS, STATUS_COLORS } from '../../utils/priorityColors';

/**
 * TaskEditRow — inline editable row used for both creating and editing
 * a task within a group's TaskTable.
 *
 * On create: `initialTask` is null, inputs start empty. Save → POST /api/tasks
 * On edit:   `initialTask` is a populated task, inputs start pre-filled.
 *            Save → PUT /api/tasks/:id
 *
 * Controls in the row (see Design doc Section 11):
 *   [Task name input (auto-focus)] [Priority] [Status] [Assignees] [Due Date] [✓] [✗]
 *
 * Props:
 *   members      — org members ({ _id, name, profilePic })
 *   initialTask  — optional existing task (for edit mode)
 *   onSave       — async (payload) => void  (payload has: name, priority, status, assignedTo, dueDate)
 *   onCancel     — () => void
 *   isLast       — removes bottom border when this is the last row
 */
const PRIORITY_OPTIONS = Object.entries(PRIORITY_COLORS).map(([v, e]) => ({
  value: v,
  label: e.label,
}));
const STATUS_OPTIONS = Object.entries(STATUS_COLORS).map(([v, e]) => ({
  value: v,
  label: e.label,
}));

const toDateInputValue = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  // YYYY-MM-DD
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TaskEditRow = ({
  members = [],
  initialTask = null,
  onSave,
  onCancel,
  isLast = false,
  isAdmin = false,
}) => {
  const [name, setName] = useState(initialTask?.name || '');
  const [priority, setPriority] = useState(initialTask?.priority || 'medium');
  const [status, setStatus] = useState(initialTask?.status || 'not_started');
  const [assignedTo, setAssignedTo] = useState(() => {
    const raw = initialTask?.assignedTo || [];
    return raw.map((u) => (typeof u === 'string' ? u : u._id));
  });
  const [dueDate, setDueDate] = useState(() =>
    toDateInputValue(initialTask?.dueDate)
  );
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave?.({
        name: name.trim(),
        priority,
        status,
        assignedTo,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        sendEmailNotification: true,
      });
    } catch (err) {
      // Parent surfaces the error; we just release the spinner so user can retry
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
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
      {/* Checkbox slot — empty placeholder */}
      <td style={{ width: 40, padding: '0 0 0 16px' }} />

      {/* Task name */}
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
            e.currentTarget.style.border =
              '1.5px solid var(--color-accent)';
            e.currentTarget.style.boxShadow =
              '0 0 0 3px rgba(37, 99, 235, 0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1.5px solid var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </td>

      {/* Priority */}
      <td style={{ width: 130, padding: '0 8px' }}>
        <Dropdown
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
          size="sm"
        />
      </td>

      {/* Status */}
      <td style={{ width: 160, padding: '0 8px' }}>
        <Dropdown
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          size="sm"
        />
      </td>

      {/* Assignees */}
      <td style={{ width: 160, padding: '0 8px' }}>
        <AssigneePicker
          members={members}
          value={assignedTo}
          onChange={setAssignedTo}
          isAdmin={isAdmin}
        />
      </td>

      {/* Due date */}
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

      {/* Comments placeholder — keeps column alignment with TaskRow */}
      <td style={{ width: 48 }} />

      {/* Save / Cancel */}
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
            onClick={() => onCancel?.()}
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
