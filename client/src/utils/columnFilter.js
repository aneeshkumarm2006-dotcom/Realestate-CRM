/**
 * columnFilter.js — client mirror of the canonical filter shape
 * `[{ columnId, op: 'eq'|'in'|'between', value }]` (see
 * server/src/utils/columnFilter.js and the TableView evaluator).
 *
 * Used by the Board view's column-aware filter bar so a flexible board filters
 * by its OWN columns (Lead Status, Assigned To, …) instead of the fixed legacy
 * task fields. Operates purely on a task's stored `columnValues`.
 */

const readVal = (task, colId) =>
  task && task.columnValues ? task.columnValues[colId?.toString()] : undefined;

const toStr = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v._id != null ? String(v._id) : null;
  return String(v);
};

const toArr = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(toStr).filter((s) => s != null);
  const s = toStr(v);
  return s == null ? [] : [s];
};

/** Evaluate one clause against a task. Mirrors TableView/clauseMatch. */
export const clauseMatch = (task, clause) => {
  if (!clause || !clause.columnId) return true;
  const v = readVal(task, clause.columnId);
  if (clause.op === 'in') {
    const list = Array.isArray(clause.value)
      ? clause.value
      : String(clause.value || '').split(',');
    const allowed = new Set(list.map((s) => String(s).trim()).filter(Boolean));
    if (allowed.size === 0) return true; // empty selection imposes no constraint
    // 'unassigned' (empty person/value) is a synthetic option.
    const vals = toArr(v);
    if (allowed.has('__empty__') && vals.length === 0) return true;
    return vals.some((x) => allowed.has(x));
  }
  if (clause.op === 'eq') {
    const want = toStr(clause.value);
    if (want == null) return true;
    return Array.isArray(v) ? toArr(v).includes(want) : toStr(v) === want;
  }
  return true;
};

/** AND across all clauses; an empty/absent filter matches everything. */
export const taskMatchesColumnFilter = (task, clauses) =>
  !Array.isArray(clauses) ||
  clauses.length === 0 ||
  clauses.every((c) => clauseMatch(task, c));

// Column types that make sense as discrete multi-select filter chips.
export const FILTERABLE_COLUMN_TYPES = ['status', 'dropdown', 'tags', 'person', 'checkbox'];

/** The board's columns that should appear as filter chips (in column order). */
export const filterableColumns = (board) => {
  const cols = Array.isArray(board?.columns) ? board.columns : [];
  return cols
    .filter((c) => !c.isPrimary && FILTERABLE_COLUMN_TYPES.includes(c.type))
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Selectable options for a column's filter popover.
 *   status/dropdown/tags → from the column's own options (with colors)
 *   person               → derived from the values present across `allTasks`
 *   checkbox             → Checked / Unchecked
 * `labels` lets the caller localise the synthetic checkbox / unassigned rows.
 */
export const optionsForColumn = (column, allTasks = [], labels = {}) => {
  if (!column) return [];
  if (column.type === 'checkbox') {
    return [
      { id: 'true', label: labels.checked || 'Checked' },
      { id: 'false', label: labels.unchecked || 'Unchecked' },
    ];
  }
  if (column.type === 'person') {
    const byId = new Map();
    for (const task of allTasks) {
      const raw = task?.columnValues?.[column._id?.toString()];
      const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      for (const p of arr) {
        const id = p && p._id ? String(p._id) : toStr(p);
        if (!id) continue;
        const name = (p && p.name) || '';
        if (!byId.has(id) || (!byId.get(id).label && name)) {
          byId.set(id, { id, label: name || id, profilePic: p?.profilePic });
        }
      }
    }
    const people = Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    return [{ id: '__empty__', label: labels.unassigned || 'Unassigned', italic: true }, ...people];
  }
  // status / dropdown / tags — from the column's configured options.
  const opts = Array.isArray(column.settings?.options) ? column.settings.options : [];
  return opts
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((o) => ({ id: String(o.id), label: o.label, color: o.color }));
};

/** The selected option-ids for a column, read out of the clause array. */
export const selectionForColumn = (clauses, columnId) => {
  const id = columnId?.toString();
  const clause = (clauses || []).find((c) => c.columnId === id);
  if (!clause) return [];
  return Array.isArray(clause.value) ? clause.value : [];
};

/** Return a new clause array with `columnId`'s selection set to `ids`. */
export const setColumnSelection = (clauses, columnId, ids) => {
  const id = columnId?.toString();
  const rest = (clauses || []).filter((c) => c.columnId !== id);
  if (!ids || ids.length === 0) return rest;
  return [...rest, { columnId: id, op: 'in', value: ids }];
};

/** How many columns currently constrain the view (non-empty selections). */
export const countColumnClauses = (clauses) =>
  (clauses || []).filter((c) => Array.isArray(c.value) && c.value.length > 0).length;
