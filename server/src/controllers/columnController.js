/**
 * columnController.js — CRUD for the flexible-columns engine (Phase 1, F1).
 *
 * Routes (wired in routes/boards.js under `:id`):
 *   GET    /api/boards/:id/columns
 *   POST   /api/boards/:id/columns
 *   PATCH  /api/boards/:id/columns/reorder
 *   PATCH  /api/boards/:id/columns/:cid
 *   DELETE /api/boards/:id/columns/:cid
 *
 * Member auth for `GET`; admin auth for write routes. Validation hits
 * `columnTypes.js` before persistence.
 */

const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');
const Organisation = require('../models/Organisation');
const { getColumnType } = require('../utils/columnTypes');

const isOrgAdmin = (org, userId) =>
  !!org &&
  (
    (org.admin && org.admin.toString() === userId) ||
    (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId))
  );

/**
 * Load board + org and confirm the calling user is a member.
 *
 * Returns { board, org, isAdmin } on success, or { status, error } on
 * failure. Mirrors `loadBoardContext` in boardController so we don't
 * couple the two controllers but keep the same shape.
 */
const loadBoardContext = async (boardId, userId) => {
  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    return { status: 400, error: 'Invalid board id' };
  }
  const board = await Board.findById(boardId);
  if (!board) return { status: 404, error: 'Board not found' };

  const org = await Organisation.findById(board.organisation);
  if (!org) return { status: 404, error: 'Organisation not found' };

  const isMember = org.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { status: 403, error: 'Not a member of this organisation' };
  }
  return { board, org, isAdmin: isOrgAdmin(org, userId) };
};

const serializeColumns = (board) =>
  (board.columns || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

/**
 * Generate a stable slug from a name, then suffix it with `-2`, `-3`, ...
 * until it's unique within the board. Slugs only contain [a-z0-9_].
 */
const slugify = (name) => {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'column';
};

const uniqueSlug = (board, baseName) => {
  const existing = new Set((board.columns || []).map((c) => c.key));
  const base = slugify(baseName);
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
};

const nextOrder = (board) => {
  const cols = board.columns || [];
  if (cols.length === 0) return 0;
  return Math.max(...cols.map((c) => c.order || 0)) + 1;
};

/**
 * GET /api/boards/:id/columns
 */
const listColumns = async (req, res) => {
  try {
    const ctx = await loadBoardContext(req.params.id, req.user.userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    return res.json({ columns: serializeColumns(ctx.board) });
  } catch (err) {
    console.error('listColumns error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/boards/:id/columns
 * Body: { name, type, settings?, width?, after?, key?, isPrimary? }
 *
 * `after` is the column id to insert the new column after; appends if absent.
 * Admin-only. Validates `settings` through the type registry.
 */
const addColumn = async (req, res) => {
  try {
    const ctx = await loadBoardContext(req.params.id, req.user.userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { board } = ctx;
    const { name, type, settings = {}, width, after, key, isPrimary } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Column name is required' });
    }
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'Column type is required' });
    }
    const entry = getColumnType(type);
    if (!entry) {
      return res.status(400).json({ error: `Unknown column type: ${type}` });
    }

    // Validate the default value against the new column's settings — this
    // catches malformed `settings` payloads early (e.g. dropdown with no
    // `options`). Registry validators are permissive about null, so we
    // synthesize an option-id when the type needs one.
    try {
      const probe = entry.defaultValue ? entry.defaultValue(settings) : null;
      entry.validate(probe, settings);
    } catch (err) {
      return res.status(400).json({ error: `Invalid settings: ${err.message}` });
    }

    // Build the column subdoc. `key` is optional in the request; if absent,
    // we derive one from the name and de-dupe.
    const desiredKey = typeof key === 'string' && key.trim() ? slugify(key) : null;
    let finalKey = desiredKey || uniqueSlug(board, name);
    if ((board.columns || []).some((c) => c.key === finalKey)) {
      finalKey = uniqueSlug(board, name);
    }

    // Insertion: after-id semantics if provided.
    const cols = board.columns || [];
    const insertIndex = after
      ? cols.findIndex((c) => c._id.toString() === after.toString())
      : -1;
    const order = nextOrder(board);

    const column = {
      key: finalKey,
      name: name.trim(),
      type,
      settings: settings || {},
      order,
      width: typeof width === 'number' && width > 40 ? width : 160,
      isPrimary:
        isPrimary === true && cols.every((c) => c.isPrimary !== true),
    };

    if (insertIndex >= 0 && insertIndex < cols.length - 1) {
      // Renumber order so the new column sits right after the anchor.
      const anchorOrder = cols[insertIndex].order || 0;
      column.order = anchorOrder + 0.5;
      board.columns.push(column);
      // Normalise orders to integers after the splice.
      const sorted = board.columns
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      sorted.forEach((c, i) => {
        c.order = i;
      });
    } else {
      board.columns.push(column);
    }

    // First column on the board is automatically primary.
    if (!board.columns.some((c) => c.isPrimary)) {
      board.columns[0].isPrimary = true;
    }

    await board.save();

    const created = board.columns.find((c) => c.key === finalKey);
    return res.status(201).json({ column: created, columns: serializeColumns(board) });
  } catch (err) {
    console.error('addColumn error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PATCH /api/boards/:id/columns/:cid
 * Body: { name?, settings?, width? } — type changes are out of scope for v1.
 */
const updateColumn = async (req, res) => {
  try {
    const ctx = await loadBoardContext(req.params.id, req.user.userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { board } = ctx;
    const { cid } = req.params;
    const column = board.columns.id(cid);
    if (!column) return res.status(404).json({ error: 'Column not found' });

    const { name, settings, width } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Column name cannot be empty' });
      }
      column.name = name.trim();
    }
    if (settings !== undefined) {
      const entry = getColumnType(column.type);
      if (!entry) {
        return res.status(400).json({ error: `Unknown column type: ${column.type}` });
      }
      try {
        const probe = entry.defaultValue ? entry.defaultValue(settings) : null;
        entry.validate(probe, settings);
      } catch (err) {
        return res.status(400).json({ error: `Invalid settings: ${err.message}` });
      }
      column.settings = settings;
      // mongoose doesn't track Mixed mutations — flag manually.
      column.markModified('settings');
    }
    if (width !== undefined) {
      if (typeof width !== 'number' || width < 40 || width > 1000) {
        return res.status(400).json({ error: 'width must be between 40 and 1000' });
      }
      column.width = width;
    }

    await board.save();
    return res.json({ column, columns: serializeColumns(board) });
  } catch (err) {
    console.error('updateColumn error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PATCH /api/boards/:id/columns/reorder
 * Body: { order: [cid, ...] } — must list every column id exactly once.
 */
const reorderColumns = async (req, res) => {
  try {
    const ctx = await loadBoardContext(req.params.id, req.user.userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { board } = ctx;
    const order = Array.isArray(req.body?.order) ? req.body.order : null;
    if (!order) return res.status(400).json({ error: 'order[] is required' });

    const currentIds = board.columns.map((c) => c._id.toString());
    const requestedIds = order.map((id) => id.toString());
    if (
      requestedIds.length !== currentIds.length ||
      !requestedIds.every((id) => currentIds.includes(id)) ||
      new Set(requestedIds).size !== requestedIds.length
    ) {
      return res
        .status(400)
        .json({ error: 'order must list every column id exactly once' });
    }

    const indexById = new Map(requestedIds.map((id, i) => [id, i]));
    for (const col of board.columns) {
      col.order = indexById.get(col._id.toString());
    }
    await board.save();

    return res.json({ columns: serializeColumns(board) });
  } catch (err) {
    console.error('reorderColumns error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/boards/:id/columns/:cid
 *
 * - 400 if the column is the primary.
 * - Otherwise `$unset` `columnValues.<cid>` on every Task in the board.
 */
const deleteColumn = async (req, res) => {
  try {
    const ctx = await loadBoardContext(req.params.id, req.user.userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { board } = ctx;
    const { cid } = req.params;
    const column = board.columns.id(cid);
    if (!column) return res.status(404).json({ error: 'Column not found' });
    if (column.isPrimary) {
      return res.status(400).json({ error: 'Cannot delete the primary column' });
    }

    board.columns.pull({ _id: cid });
    await board.save();

    await Task.updateMany(
      { board: board._id },
      { $unset: { [`columnValues.${cid}`]: '' } }
    );

    return res.json({ columns: serializeColumns(board) });
  } catch (err) {
    console.error('deleteColumn error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  listColumns,
  addColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
};
