import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';

/**
 * CalendarViewForm — create / edit a saved calendar view (F12.5).
 *
 * Config: board picker (or "global"), source column (date/timeline only),
 * color-by column (status/dropdown/tags/person), a filter builder over the
 * shared filter shape `[{ columnId, op, value }]`, a layout selector, an
 * optional resource column (shown when layout=resource), and an isShared toggle.
 *
 * Props:
 *   isOpen, onClose
 *   boards   — [{ _id, name, columns: [{ _id, name, type, settings }] }]
 *   initial  — existing view to edit (or null to create)
 *   saving   — bool (disables the submit button)
 *   error    — server error string
 *   onSubmit(payload)
 */

const SOURCE_TYPES = ['date', 'timeline'];
const COLOR_TYPES = ['status', 'dropdown', 'tags', 'person'];
const RESOURCE_TYPES = ['status', 'dropdown', 'tags', 'person'];

const LAYOUT_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'resource', label: 'Resource (one row per agent/option)' },
];

const OP_OPTIONS = [
  { value: 'eq', label: 'is' },
  { value: 'in', label: 'is any of' },
  { value: 'between', label: 'between' },
];

const GLOBAL = '__global__';

// Serialize a filter row's free-text value into the shared shape.
const serializeFilterValue = (op, raw) => {
  const text = (raw || '').trim();
  if (op === 'in') return text.split(',').map((s) => s.trim()).filter(Boolean);
  if (op === 'between') {
    const [a, b] = text.split(',').map((s) => s.trim());
    return [a || null, b || null];
  }
  return text;
};

// Inverse — turn an existing filter value back into editable text.
const deserializeFilterValue = (value) => {
  if (Array.isArray(value)) return value.map((v) => (v == null ? '' : v)).join(', ');
  return value == null ? '' : String(value);
};

const CalendarViewForm = ({
  isOpen,
  onClose,
  boards = [],
  initial = null,
  saving = false,
  error = '',
  onSubmit,
}) => {
  const [name, setName] = useState(initial?.name || '');
  const [boardId, setBoardId] = useState(initial?.boardId ? String(initial.boardId) : GLOBAL);
  const [sourceColumnId, setSourceColumnId] = useState(initial?.sourceColumnId || '');
  const [colorByColumnId, setColorByColumnId] = useState(initial?.colorByColumnId || '');
  const [layout, setLayout] = useState(initial?.layout || 'month');
  const [resourceColumnId, setResourceColumnId] = useState(initial?.resourceColumnId || '');
  const [isShared, setIsShared] = useState(!!initial?.isShared);
  const [filterRows, setFilterRows] = useState(() =>
    Array.isArray(initial?.filter)
      ? initial.filter.map((c) => ({
          columnId: c.columnId || '',
          op: c.op || 'eq',
          valueText: deserializeFilterValue(c.value),
        }))
      : []
  );
  const [localError, setLocalError] = useState('');

  const selectedBoard = useMemo(
    () => (boardId === GLOBAL ? null : boards.find((b) => String(b._id) === String(boardId)) || null),
    [boards, boardId]
  );
  const columns = selectedBoard?.columns || [];

  const colOptions = (types) =>
    columns
      .filter((c) => types.includes(c.type))
      .map((c) => ({ value: String(c._id), label: c.name }));

  const boardOptions = [
    { value: GLOBAL, label: 'Global — all tasks by due date' },
    ...boards.map((b) => ({ value: String(b._id), label: b.name })),
  ];

  const allColumnOptions = columns.map((c) => ({ value: String(c._id), label: `${c.name} (${c.type})` }));

  const onChangeBoard = (next) => {
    setBoardId(next);
    // Reset column selections — they're board-specific.
    setSourceColumnId('');
    setColorByColumnId('');
    setResourceColumnId('');
    setFilterRows([]);
    if (next === GLOBAL && layout === 'resource') setLayout('month');
  };

  const addFilterRow = () =>
    setFilterRows((rows) => [...rows, { columnId: '', op: 'eq', valueText: '' }]);
  const updateFilterRow = (idx, patch) =>
    setFilterRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeFilterRow = (idx) =>
    setFilterRows((rows) => rows.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Please give the view a name.');
      return;
    }
    if (boardId !== GLOBAL && !sourceColumnId) {
      setLocalError('Pick a source (date or timeline) column for a board view.');
      return;
    }
    if (layout === 'resource' && (boardId === GLOBAL || !resourceColumnId)) {
      setLocalError('A resource layout needs a board and a resource column.');
      return;
    }

    const filter = filterRows
      .filter((r) => r.columnId)
      .map((r) => ({
        columnId: r.columnId,
        op: r.op,
        value: serializeFilterValue(r.op, r.valueText),
      }));

    onSubmit?.({
      name: name.trim(),
      boardId: boardId === GLOBAL ? null : boardId,
      sourceColumnId: boardId === GLOBAL ? null : sourceColumnId || null,
      colorByColumnId: boardId === GLOBAL ? null : colorByColumnId || null,
      resourceColumnId: layout === 'resource' ? resourceColumnId || null : null,
      layout,
      filter,
      isShared,
    });
  };

  const shownError = localError || error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Edit calendar view' : 'New calendar view'}
      maxWidth={560}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create view'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="View name"
          required
          placeholder="e.g. Move-ins by agent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Dropdown
          label="Board"
          options={boardOptions}
          value={boardId}
          onChange={onChangeBoard}
          placeholder="Select a board"
        />

        {boardId !== GLOBAL && (
          <>
            <Dropdown
              label="Source column (date / timeline)"
              options={colOptions(SOURCE_TYPES)}
              value={sourceColumnId}
              onChange={setSourceColumnId}
              placeholder="Pick the column that supplies the date"
            />

            <Dropdown
              label="Color by (optional)"
              options={[{ value: '', label: 'None' }, ...colOptions(COLOR_TYPES)]}
              value={colorByColumnId}
              onChange={setColorByColumnId}
              placeholder="Color events by a column"
            />
          </>
        )}

        <Dropdown
          label="Layout"
          options={boardId === GLOBAL ? LAYOUT_OPTIONS.filter((o) => o.value !== 'resource') : LAYOUT_OPTIONS}
          value={layout}
          onChange={setLayout}
        />

        {layout === 'resource' && boardId !== GLOBAL && (
          <Dropdown
            label="Resource column (one row per value)"
            options={colOptions(RESOURCE_TYPES)}
            value={resourceColumnId}
            onChange={setResourceColumnId}
            placeholder="Group rows by this column"
          />
        )}

        {/* Filter builder — shared shape [{ columnId, op, value }] */}
        {boardId !== GLOBAL && (
          <div>
            <label className="block mb-2 font-body font-medium text-[color:var(--color-text-secondary)] text-xs uppercase tracking-wide">
              Filter (optional)
            </label>
            <div className="flex flex-col gap-2">
              {filterRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div style={{ flex: '1 1 38%' }}>
                    <Dropdown
                      size="sm"
                      options={allColumnOptions}
                      value={row.columnId}
                      onChange={(v) => updateFilterRow(idx, { columnId: v })}
                      placeholder="Column"
                    />
                  </div>
                  <div style={{ flex: '0 0 110px' }}>
                    <Dropdown
                      size="sm"
                      options={OP_OPTIONS}
                      value={row.op}
                      onChange={(v) => updateFilterRow(idx, { op: v })}
                    />
                  </div>
                  <div style={{ flex: '1 1 38%' }}>
                    <Input
                      value={row.valueText}
                      onChange={(e) => updateFilterRow(idx, { valueText: e.target.value })}
                      placeholder={
                        row.op === 'in'
                          ? 'a, b, c'
                          : row.op === 'between'
                          ? 'min, max'
                          : 'value / option id'
                      }
                      style={{ height: 32 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFilterRow(idx)}
                    aria-label="Remove filter"
                    className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)]"
                    style={{ width: 30, height: 30, flexShrink: 0 }}
                  >
                    <Trash2 size={14} color="var(--color-text-secondary)" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addFilterRow}
                className="inline-flex items-center gap-1.5 font-body font-medium self-start transition-colors duration-150 hover:text-[color:var(--color-accent-hover)]"
                style={{
                  fontSize: 13,
                  color: 'var(--color-accent)',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 0',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} aria-hidden="true" />
                Add filter condition
              </button>
            </div>
            <p className="mt-1.5 font-body" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Values use option ids for status/dropdown/tags and user ids for person columns.
            </p>
          </div>
        )}

        {/* Shared toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
          />
          <span className="font-body" style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>
            Share with the whole workspace
          </span>
        </label>

        {shownError && (
          <p className="font-body" style={{ fontSize: 13, color: 'var(--color-status-stuck)' }}>
            {shownError}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default CalendarViewForm;
