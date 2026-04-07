import { MoreHorizontal, MessageSquare } from 'lucide-react';
import Chip from '../ui/Chip';
import { formatShortDate, isOverdue } from '../../utils/dateUtils';

/**
 * TaskRow — a single row in the board task table.
 *
 * Columns (see Macan_Design.md Section 6.7):
 *   [Checkbox 40px] [Name flex min-240px] [Priority 130px] [Status 160px]
 *   [Owner 160px] [Due Date 140px] [Actions 48px]
 *
 * Props:
 *   task        — populated task doc
 *   selected    — checkbox state
 *   onSelect    — (taskId, checked) => void
 *   onOpen      — called when the task name is clicked (opens comment panel)
 *   onStatusClick — called when the status chip is clicked
 *   onActionsClick — called when ⋯ menu button is clicked
 *   isLast      — whether this is the last row in the table (removes bottom border)
 */
const TaskRow = ({
  task,
  selected = false,
  onSelect,
  onOpen,
  onStatusClick,
  onActionsClick,
  isLast = false,
}) => {
  const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];
  const overdue = isOverdue(task.dueDate) && task.status !== 'done';

  return (
    <tr
      className="transition-colors duration-100 hover:bg-[color:var(--color-bg-subtle)]"
      style={{
        height: 48,
        borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {/* Checkbox */}
      <td style={{ width: 40, padding: '0 0 0 16px' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(task._id, e.target.checked)}
          aria-label={`Select ${task.name}`}
          style={{
            width: 16,
            height: 16,
            accentColor: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        />
      </td>

      {/* Task Name */}
      <td style={{ padding: '0 16px', minWidth: 240 }}>
        <button
          type="button"
          onClick={() => onOpen?.(task)}
          className="text-left font-body transition-colors duration-150 hover:underline hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {task.name}
        </button>
      </td>

      {/* Priority */}
      <td style={{ width: 130, padding: '0 16px' }}>
        {task.priority ? (
          <Chip type="priority" value={task.priority} />
        ) : (
          <span
            className="font-body"
            style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
          >
            —
          </span>
        )}
      </td>

      {/* Status */}
      <td style={{ width: 160, padding: '0 16px' }}>
        <Chip
          type="status"
          value={task.status || 'not_started'}
          onClick={
            onStatusClick ? (e) => onStatusClick(task, e) : undefined
          }
        />
      </td>

      {/* Owner / Assigned to */}
      <td style={{ width: 160, padding: '0 16px' }}>
        {assignees.length > 0 ? (
          <AssigneeStack assignees={assignees} />
        ) : (
          <span
            className="font-body"
            style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
          >
            Unassigned
          </span>
        )}
      </td>

      {/* Due Date */}
      <td style={{ width: 170, padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          {task.dueDate ? (
            <span
              className="font-body"
              style={{
                fontSize: 13,
                fontWeight: overdue ? 600 : 500,
                color: overdue
                  ? 'var(--color-status-stuck)'
                  : 'var(--color-text-primary)',
              }}
            >
              {formatShortDate(task.dueDate)}
            </span>
          ) : (
            <span
              className="font-body"
              style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
            >
              —
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen?.(task)}
            aria-label="Open comments"
            className="flex items-center justify-center rounded transition-colors duration-150 hover:bg-[color:var(--color-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            style={{ width: 24, height: 24, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <MessageSquare size={15} color="var(--color-text-secondary)" aria-hidden="true" />
          </button>
        </div>
      </td>

      {/* Actions — only rendered when a handler is supplied (admin only) */}
      <td style={{ width: 48, padding: '0 8px 0 0' }}>
        {onActionsClick ? (
          <button
            type="button"
            onClick={(e) => onActionsClick(task, e)}
            aria-label="Task actions"
            className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            style={{ width: 28, height: 28, marginLeft: 'auto' }}
          >
            <MoreHorizontal
              size={16}
              color="var(--color-text-secondary)"
              aria-hidden="true"
            />
          </button>
        ) : null}
      </td>
    </tr>
  );
};

/**
 * Stacked avatar display for task assignees. Shows up to 3 avatars with
 * an overlap, then a "+N" bubble if there are more.
 */
const AssigneeStack = ({ assignees }) => {
  const visible = assignees.slice(0, 3);
  const remaining = assignees.length - visible.length;
  const first = assignees[0];
  const firstName = (first && first.name) || '';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center">
        {visible.map((u, i) => (
          <Avatar
            key={u._id || i}
            user={u}
            style={{
              marginLeft: i === 0 ? 0 : -8,
              zIndex: visible.length - i,
            }}
          />
        ))}
        {remaining > 0 && (
          <span
            className="inline-flex items-center justify-center font-body font-semibold"
            style={{
              width: 24,
              height: 24,
              marginLeft: -8,
              borderRadius: '50%',
              background: 'var(--color-bg-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: 10,
              border: '2px solid var(--color-bg-surface, #FFFFFF)',
            }}
          >
            +{remaining}
          </span>
        )}
      </div>
      {assignees.length === 1 && firstName && (
        <span
          className="font-body truncate"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {firstName}
        </span>
      )}
    </div>
  );
};

/**
 * Render either a user's profile picture or their initial as a fallback.
 */
const Avatar = ({ user, style = {} }) => {
  const name = user?.name || '';
  const initial = name.charAt(0).toUpperCase() || '?';
  const hasPic = !!user?.profilePic;

  const base = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid var(--color-bg-surface, #FFFFFF)',
    flexShrink: 0,
    ...style,
  };

  if (hasPic) {
    return (
      <img
        src={user.profilePic}
        alt={name}
        style={{ ...base, objectFit: 'cover' }}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className="inline-flex items-center justify-center font-body font-semibold"
      style={{
        ...base,
        background: 'var(--color-accent-light)',
        color: 'var(--color-accent-text)',
        fontSize: 10,
      }}
    >
      {initial}
    </span>
  );
};

export default TaskRow;
