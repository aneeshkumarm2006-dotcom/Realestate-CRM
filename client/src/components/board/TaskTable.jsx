import { useState } from 'react';
import TaskRow from './TaskRow';
import TaskEditRow from './TaskEditRow';
import TaskCardList from './TaskCardList';

/**
 * TaskTable — the core spreadsheet-style table used inside a board group.
 *
 * Column widths match Design doc Section 6.7:
 *   Checkbox 40px | Name flex (min 240px) | Priority 130px | Status 160px |
 *   Owner 160px | Due Date 140px | Actions 48px
 *
 * Inline editing: if `editingTaskId` equals a task's _id, that row is replaced
 * with a TaskEditRow pre-filled with the task's data. If `isCreating` is true,
 * a blank TaskEditRow is appended at the bottom.
 *
 * Props:
 *   tasks            — array of populated Task objects
 *   members          — org members (passed into TaskEditRow)
 *   editingTaskId    — id of the task currently being edited (or null)
 *   isCreating       — if true, renders the trailing "new task" edit row
 *   onOpenTask       — called when a task name is clicked
 *   onStatusClick    — called when a status chip is clicked
 *   onActionsClick   — called when the ⋯ action menu is clicked on a row
 *   onSaveNew        — async (payload) => void — create a new task
 *   onSaveEdit       — async (taskId, payload) => void — update an existing task
 *   onCancelEdit     — cancel inline creation or edit
 *   emptyLabel       — text rendered when the group has no tasks
 */
const COLUMNS = [
  { key: 'check',    label: '',          width: 40,  align: 'center' },
  { key: 'name',     label: 'Task',      width: null, minWidth: 240 },
  { key: 'priority', label: 'Priority',  width: 130 },
  { key: 'status',   label: 'Status',    width: 160 },
  { key: 'owner',    label: 'Owner',     width: 160 },
  { key: 'due',      label: 'Due Date',  width: 140 },
  { key: 'comments', label: '',          width: 48 },
  { key: 'actions',  label: '',          width: 48 },
];

const TaskTable = ({
  tasks = [],
  members = [],
  editingTaskId = null,
  isCreating = false,
  createKey = 0,
  isAdmin = false,
  highlightedTaskId = null,
  onOpenTask,
  onStatusClick,
  onPriorityClick,
  onActionsClick,
  onSaveNew,
  onSaveEdit,
  onCancelEdit,
  emptyLabel = 'No tasks in this group yet',
}) => {
  const [selected, setSelected] = useState(() => new Set());

  const toggleSelect = (id, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelected(new Set(tasks.map((t) => t._id)));
    else setSelected(new Set());
  };

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const noRows = tasks.length === 0 && !isCreating;
  // When an edit row is active, dropdowns inside rows need to escape the
  // table's horizontal scroll clipping.
  const isInlineEditing = isCreating || editingTaskId !== null;

  return (
    <>
      {/* Mobile stacked cards (<768px) — only for display. When inline editing
          is active on mobile, the table view below takes over so users can
          complete the form. See Design doc Section 8.2. */}
      {!isInlineEditing && (
        <div className="md:hidden">
          <TaskCardList
            tasks={tasks}
            onOpenTask={onOpenTask}
            onStatusClick={onStatusClick}
            onPriorityClick={onPriorityClick}
            onActionsClick={onActionsClick}
            highlightedTaskId={highlightedTaskId}
            emptyLabel={emptyLabel}
          />
        </div>
      )}

      {/* Desktop table view (md+) — also used on mobile when inline editing
          is active so the user can fill in the form fields. */}
      <div
        className={[
          'w-full',
          isInlineEditing ? 'overflow-visible' : 'overflow-x-auto hidden md:block',
        ].join(' ')}
      >
      <table
        className="w-full"
        style={{
          borderCollapse: 'collapse',
          background: 'var(--color-bg-surface, #FFFFFF)',
        }}
      >
        <thead>
          <tr
            style={{
              height: 40,
              background: 'var(--color-bg-subtle)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={{
                  width: col.width || undefined,
                  minWidth: col.minWidth || undefined,
                  padding: '0 16px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {col.key === 'check' ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Select all tasks"
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: 'var(--color-accent)',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {noRows ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                style={{
                  padding: '20px 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            tasks.map((task, i) => {
              const isEditing = editingTaskId === task._id;
              const isLastExisting = i === tasks.length - 1;
              const isLastRow = isLastExisting && !isCreating;

              if (isEditing) {
                return (
                  <TaskEditRow
                    key={task._id}
                    members={members}
                    initialTask={task}
                    isLast={isLastRow}
                    isAdmin={isAdmin}
                    onSave={(payload) => onSaveEdit?.(task._id, payload)}
                    onCancel={onCancelEdit}
                  />
                );
              }

              return (
                <TaskRow
                  key={task._id}
                  task={task}
                  selected={selected.has(task._id)}
                  onSelect={toggleSelect}
                  onOpen={onOpenTask}
                  onStatusClick={onStatusClick}
                  onPriorityClick={onPriorityClick}
                  onActionsClick={onActionsClick}
                  isLast={isLastRow}
                  highlighted={highlightedTaskId === task._id}
                />
              );
            })
          )}

          {isCreating && (
            <TaskEditRow
              key={`__new__-${createKey}`}
              members={members}
              initialTask={null}
              isLast
              isAdmin={isAdmin}
              autoFocus={false}
              onSave={onSaveNew}
              onCancel={onCancelEdit}
            />
          )}
        </tbody>
      </table>
      </div>
    </>
  );
};

export default TaskTable;
