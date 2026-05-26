const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');
const TaskGroup = require('../models/TaskGroup');
const Comment = require('../models/Comment');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const {
  createNotificationsForUsers,
} = require('../services/notificationService');
const { sendTaskAssignmentEmail } = require('../services/emailService');
const Notification = require('../models/Notification');
const eventBus = require('../services/eventBus');
const { logActivity } = require('../services/activityService');

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
// Legacy enum keys — accepted for personal tasks (which don't have a board).
const LEGACY_STATUS_KEYS = ['not_started', 'working_on_it', 'done', 'stuck'];

/**
 * Whether the current user is the admin of this org.
 */
const isOrgAdmin = (org, userId) =>
  !!org &&
  (
    (org.admin && org.admin.toString() === userId) ||
    (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId))
  );

/**
 * Load the board + its org, validating that the current user is a member
 * of the org. Returns { board, org, isAdmin } on success, or { status, error }
 * on failure.
 */
const loadBoardContext = async (boardId, userId) => {
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

/**
 * Resolve the default-status ObjectId for a board. Falls back to the first
 * status, then to the legacy enum string 'not_started' if the board has
 * no statuses configured (shouldn't happen post-migration, but guards the
 * controller against bad data).
 */
const resolveDefaultStatus = (board) => {
  if (!board || !Array.isArray(board.statuses) || board.statuses.length === 0) {
    return 'not_started';
  }
  const fav = board.statuses.find((s) => s.isDefault);
  return (fav || board.statuses[0])._id;
};

/**
 * Validate that the provided status id is one of the board's statuses.
 * Returns the matching status subdoc, or null. Accepts string ObjectIds
 * and Mongoose ObjectIds.
 */
const findBoardStatus = (board, statusInput) => {
  if (!board || !Array.isArray(board.statuses)) return null;
  if (statusInput == null) return null;
  const target = statusInput.toString();
  return board.statuses.find((s) => s._id.toString() === target) || null;
};

/**
 * Filter the input label-id list down to ids that exist on the board.
 * Returns null when input is not an array (i.e. caller didn't pass labels).
 */
const sanitizeLabelsForBoard = (board, input) => {
  if (!Array.isArray(input)) return null;
  if (!board || !Array.isArray(board.labels)) return [];
  const known = new Set(board.labels.map((l) => l._id.toString()));
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    if (!raw) continue;
    const id = raw.toString();
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

/**
 * Validate a list of assignee user ids against an org's members. Returns a
 * de-duplicated list of string ids that are actually members, or an error
 * message if any id is invalid.
 */
const validateAssignees = (assignedTo, org) => {
  if (!Array.isArray(assignedTo)) return { ids: [] };
  const memberIds = new Set(org.members.map((m) => m.toString()));
  const seen = new Set();
  const ids = [];
  for (const raw of assignedTo) {
    if (!raw) continue;
    const id = raw.toString();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: 'Invalid assignee id' };
    }
    if (!memberIds.has(id)) {
      return { error: 'Assignee is not a member of this organisation' };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids };
};

const populateTask = (query) =>
  query
    .populate('assignedTo', 'name profilePic email')
    .populate('createdBy', 'name profilePic email');

/**
 * Annotate a list of POJO tasks with `hasSubitems: bool` so the board view
 * can show an expand chevron next to rows that own children. One follow-up
 * `distinct` query — cheaper than per-row counts.
 */
const annotateHasSubitems = async (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return tasks;
  const ids = tasks.map((t) => t._id).filter(Boolean);
  if (ids.length === 0) {
    for (const t of tasks) t.hasSubitems = false;
    return tasks;
  }
  const parentIds = await Task.find({ parent: { $in: ids } }).distinct('parent');
  const hasChildren = new Set(parentIds.map((id) => id.toString()));
  for (const t of tasks) {
    t.hasSubitems = t?._id ? hasChildren.has(t._id.toString()) : false;
  }
  return tasks;
};

/**
 * Friendly status label for notification messages. Uses the board's
 * status name if the task references one of its statuses; otherwise
 * falls back to a humanised version of the input.
 */
const describeStatus = (board, statusInput) => {
  const found = findBoardStatus(board, statusInput);
  if (found) return found.name;
  if (typeof statusInput === 'string') {
    return statusInput.replace(/_/g, ' ');
  }
  return 'updated';
};

/**
 * GET /api/tasks?board=:id&group=:id
 */
const getTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { board: boardId, group: groupId } = req.query;

    if (!boardId) {
      return res.status(400).json({ error: 'Board ID required' });
    }

    const ctx = await loadBoardContext(boardId, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    // Top-level tasks only — subitems are fetched on demand via /:id/subitems.
    const filter = {
      board: boardId,
      isPersonal: { $ne: true },
      parent: null,
    };
    if (groupId) filter.group = groupId;

    const tasks = await populateTask(Task.find(filter))
      .sort({ createdAt: 1 })
      .lean();
    await annotateHasSubitems(tasks);

    return res.json({ tasks });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/:id/subitems — list direct children of a task.
 *
 * Any org member who can see the parent can read its subitems. Sorted by
 * creation time so they show in the order the user added them.
 */
const getSubitems = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const parent = await Task.findById(id);
    if (!parent) return res.status(404).json({ error: 'Task not found' });

    if (parent.isPersonal) {
      if (!parent.createdBy || parent.createdBy.toString() !== userId) {
        return res.status(403).json({ error: 'Not authorised' });
      }
    } else {
      const ctx = await loadBoardContext(parent.board, userId);
      if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    }

    const subitems = await populateTask(Task.find({ parent: id })).sort({
      createdAt: 1,
    });

    return res.json({ tasks: subitems });
  } catch (err) {
    console.error('getSubitems error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/my
 */
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Top-level only (subitems shouldn't clutter "My Tasks").
    const tasks = await Task.find({
      parent: null,
      $or: [
        { assignedTo: userObjectId, isPersonal: { $ne: true } },
        { isPersonal: true, createdBy: userObjectId },
      ],
    })
      .populate('assignedTo', 'name profilePic email')
      .populate('createdBy', 'name profilePic email')
      .populate('board', 'name visibility statuses labels')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();
    await annotateHasSubitems(tasks);

    return res.json({ tasks });
  } catch (err) {
    console.error('getMyTasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/calendar?month=:m&year=:y&org=:orgId
 */
const getCalendarTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const now = new Date();
    const rawMonth = parseInt(req.query.month, 10);
    const rawYear = parseInt(req.query.year, 10);
    const month =
      Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
        ? rawMonth
        : now.getMonth() + 1;
    const year =
      Number.isInteger(rawYear) && rawYear >= 1970 && rawYear <= 9999
        ? rawYear
        : now.getFullYear();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const orgId = req.query.org;

    let boardTaskFilter = null;
    if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
      const org = await Organisation.findById(orgId);
      if (org) {
        const isMember = org.members.some((m) => m.toString() === userId);
        if (isMember) {
          const boards = await Board.find({ organisation: orgId }).select('_id');
          const boardIds = boards.map((b) => b._id);
          if (boardIds.length > 0) {
            boardTaskFilter = {
              board: { $in: boardIds },
              isPersonal: { $ne: true },
              parent: null,
              dueDate: { $gte: start, $lt: end },
            };
          }
        }
      }
    }

    const personalFilter = {
      isPersonal: true,
      createdBy: userObjectId,
      dueDate: { $gte: start, $lt: end },
    };

    const filters = [personalFilter];
    if (boardTaskFilter) filters.push(boardTaskFilter);

    const tasks = await Task.find({ $or: filters })
      .populate('assignedTo', 'name profilePic email')
      .populate('createdBy', 'name profilePic email')
      .populate('board', 'name visibility statuses labels')
      .sort({ dueDate: 1, createdAt: 1 })
      .lean();
    await annotateHasSubitems(tasks);

    return res.json({ tasks, month, year });
  } catch (err) {
    console.error('getCalendarTasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/tasks
 *
 * Create a task. Two modes:
 *   - Board task: requires `board` and `group`. Admin only. `status` must be
 *     an ObjectId in the target board's `statuses`; if omitted, falls back
 *     to the board's default status. `labels` must reference ids in
 *     board.labels.
 *   - Personal task: `isPersonal: true`. `status` accepts the legacy enum
 *     strings.
 */
const createTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      board: boardId,
      group: groupId,
      priority,
      status,
      assignedTo,
      dueDate,
      note,
      isPersonal,
      labels,
      parent: parentId,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Personal task path
    if (isPersonal) {
      const personalStatus =
        typeof status === 'string' && LEGACY_STATUS_KEYS.includes(status)
          ? status
          : 'not_started';
      const task = await Task.create({
        name: name.trim(),
        priority: priority || 'medium',
        status: personalStatus,
        dueDate: dueDate || undefined,
        note: note || undefined,
        isPersonal: true,
        createdBy: userId,
      });
      logActivity({
        task,
        actor: userId,
        type: 'task.created',
        metadata: { taskName: task.name },
      });
      const populated = await populateTask(Task.findById(task._id));
      return res.status(201).json({ task: populated });
    }

    // Board task path — requires board + group, admin only
    if (!boardId || !groupId) {
      return res
        .status(400)
        .json({ error: 'Board and group are required for board tasks' });
    }

    const ctx = await loadBoardContext(boardId, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const group = await TaskGroup.findById(groupId);
    if (!group || group.board.toString() !== boardId) {
      return res.status(400).json({ error: 'Group does not belong to board' });
    }

    // Validate parent task (subitem creation). Parent must exist on the same
    // board; nesting beyond one level is not supported in this iteration.
    let resolvedParent = null;
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ error: 'Invalid parent id' });
      }
      const parentTask = await Task.findById(parentId);
      if (!parentTask) {
        return res.status(400).json({ error: 'Parent task not found' });
      }
      if (!parentTask.board || parentTask.board.toString() !== boardId) {
        return res.status(400).json({ error: 'Parent task is on a different board' });
      }
      if (parentTask.parent) {
        return res.status(400).json({ error: 'Subitems cannot be nested further' });
      }
      resolvedParent = parentTask._id;
    }

    // Validate status against the board's configured statuses.
    let resolvedStatus = resolveDefaultStatus(ctx.board);
    if (status !== undefined && status !== null && status !== '') {
      const match = findBoardStatus(ctx.board, status);
      if (!match) {
        return res.status(400).json({ error: 'Invalid status for this board' });
      }
      resolvedStatus = match._id;
    }

    // Validate labels against the board's configured labels.
    let resolvedLabels = [];
    if (labels !== undefined) {
      const sanitized = sanitizeLabelsForBoard(ctx.board, labels);
      if (sanitized === null) {
        return res.status(400).json({ error: 'Invalid labels payload' });
      }
      resolvedLabels = sanitized;
    }

    const { ids: assigneeIds, error: assigneeErr } = validateAssignees(
      assignedTo,
      ctx.org
    );
    if (assigneeErr) return res.status(400).json({ error: assigneeErr });

    const task = await Task.create({
      name: name.trim(),
      board: boardId,
      group: groupId,
      priority: priority || 'medium',
      status: resolvedStatus,
      labels: resolvedLabels,
      assignedTo: assigneeIds,
      dueDate: dueDate || undefined,
      note: note || undefined,
      isPersonal: false,
      parent: resolvedParent,
      createdBy: userId,
    });

    await Board.updateOne({ _id: boardId }, { $set: { updatedAt: new Date() } });

    logActivity({
      task,
      actor: userId,
      type: 'task.created',
      metadata: { taskName: task.name, isSubitem: !!resolvedParent },
    });

    // Fan out an item.created event for ITEM_CREATED automations. Subitems
    // are excluded to avoid recursion (a CREATE_SUBITEM action could otherwise
    // re-trigger itself). Personal tasks never enter this branch.
    if (!resolvedParent) {
      eventBus.emit('item.created', {
        taskId: task._id,
        boardId,
        groupId,
        statusId: resolvedStatus,
        createdByUserId: userId,
      });
    }

    if (assigneeIds.length > 0) {
      await createNotificationsForUsers({
        userIds: assigneeIds,
        type: 'assigned',
        message: `You were assigned to "${task.name}"`,
        taskId: task._id,
        orgId: ctx.board.organisation,
        excludeUserId: userId,
      });
    }

    if (assigneeIds.length > 0) {
      const taskLink = `${process.env.CLIENT_URL}/boards/${boardId}`;
      const assigneeUsers = await User.find({ _id: { $in: assigneeIds } }).select('email').lean();
      const emailResults = await Promise.allSettled(
        assigneeUsers
          .filter((u) => u.email)
          .map((u) =>
            sendTaskAssignmentEmail({
              to: u.email,
              taskName: task.name,
              priority: task.priority,
              dueDate: task.dueDate,
              taskLink,
            })
          )
      );
      emailResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[email] Failed to send to ${assigneeUsers[i]?.email}:`, result.reason?.message || result.reason);
        }
      });
    }

    const populated = await populateTask(Task.findById(task._id));
    return res.status(201).json({ task: populated });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const body = req.body || {};

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // ----- Personal task branch -----
    if (task.isPersonal) {
      if (!task.createdBy || task.createdBy.toString() !== userId) {
        return res.status(403).json({ error: 'Not authorised' });
      }
      const changes = [];
      if (typeof body.name === 'string') {
        if (!body.name.trim()) {
          return res.status(400).json({ error: 'Task name cannot be empty' });
        }
        const next = body.name.trim();
        if (next !== task.name) changes.push({ field: 'name', oldValue: task.name, newValue: next });
        task.name = next;
      }
      if (body.priority !== undefined) {
        if (!VALID_PRIORITIES.includes(body.priority)) {
          return res.status(400).json({ error: 'Invalid priority' });
        }
        if (body.priority !== task.priority) changes.push({ field: 'priority', oldValue: task.priority, newValue: body.priority });
        task.priority = body.priority;
      }
      if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !LEGACY_STATUS_KEYS.includes(body.status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        if (body.status !== task.status) changes.push({ field: 'status', oldValue: task.status, newValue: body.status });
        task.status = body.status;
      }
      if (body.dueDate !== undefined) {
        const nextDue = body.dueDate || null;
        const prevDue = task.dueDate || null;
        const prevIso = prevDue ? new Date(prevDue).toISOString() : null;
        const nextIso = nextDue ? new Date(nextDue).toISOString() : null;
        if (prevIso !== nextIso) changes.push({ field: 'dueDate', oldValue: prevIso, newValue: nextIso });
        task.dueDate = body.dueDate || undefined;
      }
      if (body.note !== undefined) {
        const nextNote = body.note || '';
        const prevNote = task.note || '';
        if (nextNote !== prevNote) changes.push({ field: 'note', oldValue: prevNote, newValue: nextNote });
        task.note = body.note || undefined;
      }
      await task.save();
      for (const c of changes) {
        logActivity({
          task,
          actor: userId,
          type: 'task.field_changed',
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          metadata: { taskName: task.name },
        });
      }
      const populated = await populateTask(Task.findById(task._id));
      return res.json({ task: populated });
    }

    // ----- Board task branch -----
    const ctx = await loadBoardContext(task.board, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    if (!ctx.isAdmin) {
      // Regular members can only change status (on any board task they can see).
      const allowedKeys = Object.keys(body).filter((k) => body[k] !== undefined);
      if (allowedKeys.length !== 1 || allowedKeys[0] !== 'status') {
        return res
          .status(403)
          .json({ error: 'Only status can be changed by members' });
      }
      const match = findBoardStatus(ctx.board, body.status);
      if (!match) {
        return res.status(400).json({ error: 'Invalid status for this board' });
      }
      const prevStatus = task.status ? task.status.toString() : null;
      task.status = match._id;
      await task.save();

      if (prevStatus !== match._id.toString()) {
        await createNotificationsForUsers({
          userIds: task.assignedTo,
          type: 'statusChanged',
          message: `Status of "${task.name}" changed to ${match.name}`,
          taskId: task._id,
          orgId: ctx.board.organisation,
          excludeUserId: userId,
        });
        logActivity({
          task,
          actor: userId,
          type: 'task.field_changed',
          field: 'status',
          oldValue: prevStatus,
          newValue: match._id.toString(),
          metadata: { taskName: task.name },
        });
      }

      const populated = await populateTask(Task.findById(task._id));
      return res.json({ task: populated });
    }

    // Admin path — any field is editable.
    const prevStatus = task.status ? task.status.toString() : null;
    const prevAssigneeIds = task.assignedTo.map((u) => u.toString());
    const prevLabelIds = (task.labels || []).map((l) => l.toString());
    const prevName = task.name;
    const prevPriority = task.priority;
    const prevDueIso = task.dueDate ? new Date(task.dueDate).toISOString() : null;
    const prevNote = task.note || '';
    const prevGroup = task.group ? task.group.toString() : null;
    let statusChanged = false;
    let newAssigneeIds = null;
    let statusName = null;
    const activityChanges = [];

    if (typeof body.name === 'string') {
      if (!body.name.trim()) {
        return res.status(400).json({ error: 'Task name cannot be empty' });
      }
      const next = body.name.trim();
      if (next !== prevName) activityChanges.push({ field: 'name', oldValue: prevName, newValue: next });
      task.name = next;
    }
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      if (body.priority !== prevPriority) activityChanges.push({ field: 'priority', oldValue: prevPriority, newValue: body.priority });
      task.priority = body.priority;
    }
    if (body.status !== undefined) {
      const match = findBoardStatus(ctx.board, body.status);
      if (!match) {
        return res.status(400).json({ error: 'Invalid status for this board' });
      }
      if (prevStatus !== match._id.toString()) {
        statusChanged = true;
        activityChanges.push({ field: 'status', oldValue: prevStatus, newValue: match._id.toString() });
      }
      task.status = match._id;
      statusName = match.name;
    }
    if (body.labels !== undefined) {
      const sanitized = sanitizeLabelsForBoard(ctx.board, body.labels);
      if (sanitized === null) {
        return res.status(400).json({ error: 'Invalid labels payload' });
      }
      const prevSet = new Set(prevLabelIds);
      const nextSet = new Set(sanitized.map((s) => s.toString()));
      const labelsChanged =
        prevSet.size !== nextSet.size ||
        [...prevSet].some((id) => !nextSet.has(id));
      if (labelsChanged) {
        activityChanges.push({ field: 'labels', oldValue: prevLabelIds, newValue: sanitized });
      }
      task.labels = sanitized;
    }
    if (body.assignedTo !== undefined) {
      const { ids, error: assigneeErr } = validateAssignees(body.assignedTo, ctx.org);
      if (assigneeErr) return res.status(400).json({ error: assigneeErr });
      const prevSet = new Set(prevAssigneeIds);
      newAssigneeIds = ids.filter((id) => !prevSet.has(id));
      const nextSet = new Set(ids);
      const assigneesChanged =
        prevSet.size !== nextSet.size ||
        [...prevSet].some((id) => !nextSet.has(id));
      if (assigneesChanged) {
        activityChanges.push({ field: 'assignees', oldValue: prevAssigneeIds, newValue: ids });
      }
      task.assignedTo = ids;
    }
    if (body.dueDate !== undefined) {
      const nextDue = body.dueDate || null;
      const nextIso = nextDue ? new Date(nextDue).toISOString() : null;
      if (prevDueIso !== nextIso) activityChanges.push({ field: 'dueDate', oldValue: prevDueIso, newValue: nextIso });
      task.dueDate = body.dueDate || undefined;
    }
    if (body.note !== undefined) {
      const nextNote = body.note || '';
      if (nextNote !== prevNote) activityChanges.push({ field: 'note', oldValue: prevNote, newValue: nextNote });
      task.note = body.note || undefined;
    }
    if (body.group !== undefined && body.group !== null) {
      const newGroup = await TaskGroup.findById(body.group);
      if (!newGroup || newGroup.board.toString() !== task.board.toString()) {
        return res
          .status(400)
          .json({ error: 'Group does not belong to board' });
      }
      if (prevGroup !== body.group.toString()) {
        activityChanges.push({ field: 'group', oldValue: prevGroup, newValue: body.group.toString() });
      }
      task.group = body.group;
    }

    await task.save();
    for (const c of activityChanges) {
      logActivity({
        task,
        actor: userId,
        type: 'task.field_changed',
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        metadata: { taskName: task.name },
      });
    }
    await Board.updateOne(
      { _id: task.board },
      { $set: { updatedAt: new Date() } }
    );

    if (newAssigneeIds && newAssigneeIds.length > 0) {
      await createNotificationsForUsers({
        userIds: newAssigneeIds,
        type: 'assigned',
        message: `You were assigned to "${task.name}"`,
        taskId: task._id,
        orgId: ctx.board.organisation,
        excludeUserId: userId,
      });
    }
    if (statusChanged) {
      await createNotificationsForUsers({
        userIds: task.assignedTo,
        type: 'statusChanged',
        message: `Status of "${task.name}" changed to ${statusName || describeStatus(ctx.board, task.status)}`,
        taskId: task._id,
        orgId: ctx.board.organisation,
        excludeUserId: userId,
      });
    }

    if (newAssigneeIds && newAssigneeIds.length > 0) {
      const taskLink = `${process.env.CLIENT_URL}/boards/${task.board}`;
      const assigneeUsers = await User.find({ _id: { $in: newAssigneeIds } }).select('email').lean();
      const emailResults = await Promise.allSettled(
        assigneeUsers
          .filter((u) => u.email)
          .map((u) =>
            sendTaskAssignmentEmail({
              to: u.email,
              taskName: task.name,
              priority: task.priority,
              dueDate: task.dueDate,
              taskLink,
            })
          )
      );
      emailResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[email] Failed to send to ${assigneeUsers[i]?.email}:`, result.reason?.message || result.reason);
        }
      });
    }

    const populated = await populateTask(Task.findById(task._id));
    return res.json({ task: populated });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Authorise a checklist mutation against a task. Personal tasks only allow
 * the creator; board tasks allow any org member (mirrors comment behaviour —
 * collaborative state should be editable by everyone who can see the task).
 * Returns { task } on success, or { status, error } on failure.
 */
const loadTaskForChecklist = async (taskId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    return { status: 400, error: 'Invalid task id' };
  }
  const task = await Task.findById(taskId);
  if (!task) return { status: 404, error: 'Task not found' };

  if (task.isPersonal) {
    if (!task.createdBy || task.createdBy.toString() !== userId) {
      return { status: 403, error: 'Not authorised' };
    }
    return { task };
  }

  const ctx = await loadBoardContext(task.board, userId);
  if (ctx.error) return { status: ctx.status, error: ctx.error };
  return { task };
};

/**
 * POST /api/tasks/:id/checklist — add a new checklist item.
 */
const addChecklistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text) {
      return res.status(400).json({ error: 'Checklist item text is required' });
    }

    const ctx = await loadTaskForChecklist(id, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    ctx.task.checklist.push({ text, done: false });
    await ctx.task.save();

    logActivity({
      task: ctx.task,
      actor: userId,
      type: 'checklist.added',
      metadata: { itemText: text, taskName: ctx.task.name },
    });

    const populated = await populateTask(Task.findById(ctx.task._id));
    return res.status(201).json({ task: populated });
  } catch (err) {
    console.error('addChecklistItem error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/tasks/:id/checklist/:itemId — toggle done and/or rename.
 */
const updateChecklistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, itemId } = req.params;
    const body = req.body || {};

    const ctx = await loadTaskForChecklist(id, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const item = ctx.task.checklist.id(itemId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    const prevText = item.text;
    const prevDone = item.done;
    const events = [];

    if (body.text !== undefined) {
      if (typeof body.text !== 'string') {
        return res.status(400).json({ error: 'Invalid text' });
      }
      const next = body.text.trim();
      if (next !== prevText) {
        events.push({ type: 'checklist.renamed', oldValue: prevText, newValue: next, metadata: { itemText: next, taskName: ctx.task.name } });
      }
      item.text = next;
    }
    if (body.done !== undefined) {
      const next = !!body.done;
      if (next !== prevDone) {
        events.push({ type: 'checklist.toggled', oldValue: prevDone, newValue: next, metadata: { itemText: item.text, taskName: ctx.task.name } });
      }
      item.done = next;
    }

    await ctx.task.save();

    for (const e of events) {
      logActivity({ task: ctx.task, actor: userId, ...e });
    }

    const populated = await populateTask(Task.findById(ctx.task._id));
    return res.json({ task: populated });
  } catch (err) {
    console.error('updateChecklistItem error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/tasks/:id/checklist/:itemId
 */
const deleteChecklistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, itemId } = req.params;

    const ctx = await loadTaskForChecklist(id, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const item = ctx.task.checklist.id(itemId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    const removedText = item.text;
    ctx.task.checklist.pull(itemId);
    await ctx.task.save();

    logActivity({
      task: ctx.task,
      actor: userId,
      type: 'checklist.deleted',
      metadata: { itemText: removedText, taskName: ctx.task.name },
    });

    const populated = await populateTask(Task.findById(ctx.task._id));
    return res.json({ task: populated });
  } catch (err) {
    console.error('deleteChecklistItem error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/tasks/:id/checklist/reorder — reorder checklist items.
 * Body: { orderedIds: [itemId, ...] } — must list every existing item exactly once.
 */
const reorderChecklist = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : null;

    if (!orderedIds) {
      return res.status(400).json({ error: 'orderedIds[] is required' });
    }

    const ctx = await loadTaskForChecklist(id, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    const currentIds = ctx.task.checklist.map((i) => i._id.toString());
    if (
      orderedIds.length !== currentIds.length ||
      !orderedIds.every((oid) => currentIds.includes(oid.toString()))
    ) {
      return res.status(400).json({ error: 'orderedIds must list every checklist item exactly once' });
    }

    const byId = new Map();
    for (const item of ctx.task.checklist) byId.set(item._id.toString(), item);
    const prevOrder = currentIds.slice();
    const nextOrder = orderedIds.map((oid) => oid.toString());
    ctx.task.checklist = orderedIds.map((oid) => byId.get(oid.toString()));
    await ctx.task.save();

    const moved = prevOrder.some((id, i) => id !== nextOrder[i]);
    if (moved) {
      logActivity({
        task: ctx.task,
        actor: userId,
        type: 'checklist.reordered',
        metadata: { taskName: ctx.task.name, itemCount: nextOrder.length },
      });
    }

    const populated = await populateTask(Task.findById(ctx.task._id));
    return res.json({ task: populated });
  } catch (err) {
    console.error('reorderChecklist error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.isPersonal) {
      if (!task.createdBy || task.createdBy.toString() !== userId) {
        return res.status(403).json({ error: 'Not authorised' });
      }
    } else {
      const ctx = await loadBoardContext(task.board, userId);
      if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
      if (!ctx.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    // Cascade subitems first — fetch their ids so their comments and
    // notifications are also cleaned up.
    const subitems = await Task.find({ parent: id }).select('_id');
    const subitemIds = subitems.map((s) => s._id);
    const idsToDelete = [id, ...subitemIds];

    // Log the deletion before the row disappears so the log can resolve task name.
    logActivity({
      task,
      actor: userId,
      type: 'task.deleted',
      metadata: { taskName: task.name, deletedSubitems: subitemIds.length },
    });

    await Comment.deleteMany({ task: { $in: idsToDelete } });
    await Notification.deleteMany({ task: { $in: idsToDelete } });
    if (subitemIds.length > 0) {
      await Task.deleteMany({ _id: { $in: subitemIds } });
    }
    await Task.deleteOne({ _id: id });

    return res.json({ success: true, deletedSubitems: subitemIds.length });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/:id/attachments — list files attached to a task.
 * Access mirrors checklist/comment behaviour: personal tasks → creator only;
 * board tasks → any org member.
 */
const getTaskAttachments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await loadTaskForChecklist(id, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const task = await Task.findById(id).populate(
      'attachments.uploadedBy',
      'name profilePic email'
    );

    return res.json({ attachments: task.attachments || [] });
  } catch (err) {
    console.error('getTaskAttachments error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/tasks/:id/attachments — upload a file (multer + Cloudinary middleware
 * does the upload) and persist its URL on the task.
 */
const uploadTaskAttachment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await loadTaskForChecklist(id, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const attachment = {
      url: req.file.path || req.file.secure_url || req.file.url,
      name: req.file.originalname || '',
      mime: req.file.mimetype || '',
      size: req.file.size || 0,
      uploadedBy: userId,
    };

    const updated = await Task.findByIdAndUpdate(
      id,
      { $push: { attachments: attachment } },
      { new: true }
    ).populate('attachments.uploadedBy', 'name profilePic email');

    const created = updated.attachments[updated.attachments.length - 1];

    logActivity({
      task: updated,
      actor: userId,
      type: 'attachment.uploaded',
      metadata: {
        attachmentName: attachment.name || 'file',
        attachmentUrl: attachment.url,
        taskName: updated.name,
      },
    });

    return res.status(201).json({ attachment: created });
  } catch (err) {
    console.error('uploadTaskAttachment error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/tasks/:id/attachments/:attachmentId — remove an attachment from
 * the task. The Cloudinary asset itself is left in place (cheaper and simpler
 * than tracking public_ids; a periodic job can prune orphaned assets).
 */
const deleteTaskAttachment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, attachmentId } = req.params;

    const result = await loadTaskForChecklist(id, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    const task = result.task;

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachmentName = attachment.name || 'file';

    await Task.findByIdAndUpdate(id, {
      $pull: { attachments: { _id: attachmentId } },
    });

    logActivity({
      task,
      actor: userId,
      type: 'attachment.deleted',
      metadata: { attachmentName, taskName: task.name },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteTaskAttachment error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getTasks,
  getMyTasks,
  getCalendarTasks,
  getSubitems,
  createTask,
  updateTask,
  deleteTask,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
  getTaskAttachments,
  uploadTaskAttachment,
  deleteTaskAttachment,
};
