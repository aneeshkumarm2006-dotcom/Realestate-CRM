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

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES = ['not_started', 'working_on_it', 'done', 'stuck'];

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
 * GET /api/tasks?board=:id&group=:id
 *
 * Return tasks filtered by board and optionally group. Populates
 * `assignedTo` (name, profilePic) and `createdBy` (name). Personal tasks
 * are NOT returned by this endpoint.
 *
 * Admins: all tasks on the board.
 * Regular users: only tasks they are assigned to, and only on public boards.
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

    // Regular users can only view tasks on public boards
    if (!ctx.isAdmin && ctx.board.visibility !== 'public') {
      return res.status(403).json({ error: 'Board not accessible' });
    }

    const filter = { board: boardId, isPersonal: { $ne: true } };
    if (groupId) filter.group = groupId;

    // Regular users only see their own assigned tasks within this board
    if (!ctx.isAdmin) {
      filter.assignedTo = new mongoose.Types.ObjectId(userId);
    }

    const tasks = await populateTask(Task.find(filter)).sort({ createdAt: 1 });

    return res.json({ tasks });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/my
 *
 * Return tasks where the current user is an assignee, plus the user's own
 * personal tasks. Populates assignedTo and board (so the frontend can show
 * which board a task came from).
 */
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const tasks = await Task.find({
      $or: [
        { assignedTo: userObjectId, isPersonal: { $ne: true } },
        { isPersonal: true, createdBy: userObjectId },
      ],
    })
      .populate('assignedTo', 'name profilePic email')
      .populate('createdBy', 'name profilePic email')
      .populate('board', 'name visibility')
      .sort({ dueDate: 1, createdAt: -1 });

    return res.json({ tasks });
  } catch (err) {
    console.error('getMyTasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tasks/calendar?month=:m&year=:y&org=:orgId
 *
 * Return tasks with a `dueDate` falling in the given month/year, scoped to
 * the current org. Admins of the org get all board tasks plus their own
 * personal tasks. Regular users get only tasks assigned to them (on public
 * boards in the org) plus their own personal tasks.
 *
 * `month` is 1-12 (calendar month, not JS 0-indexed). `year` is a 4-digit
 * year. If either is missing/invalid, defaults to the current month.
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

    // First day of month (inclusive) → first day of next month (exclusive)
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const orgId = req.query.org;

    // Determine which board tasks this user can see in this org (if any)
    let boardTaskFilter = null;
    if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
      const org = await Organisation.findById(orgId);
      if (org) {
        const isMember = org.members.some((m) => m.toString() === userId);
        if (isMember) {
          const isAdmin = isOrgAdmin(org, userId);
          if (isAdmin) {
            // Admin: all board tasks within the org
            const boards = await Board.find({ organisation: orgId }).select('_id');
            const boardIds = boards.map((b) => b._id);
            if (boardIds.length > 0) {
              boardTaskFilter = {
                board: { $in: boardIds },
                isPersonal: { $ne: true },
                dueDate: { $gte: start, $lt: end },
              };
            }
          } else {
            // Regular user: assigned tasks on public boards within the org
            const publicBoards = await Board.find({
              organisation: orgId,
              visibility: 'public',
            }).select('_id');
            const boardIds = publicBoards.map((b) => b._id);
            if (boardIds.length > 0) {
              boardTaskFilter = {
                board: { $in: boardIds },
                assignedTo: userObjectId,
                isPersonal: { $ne: true },
                dueDate: { $gte: start, $lt: end },
              };
            }
          }
        }
      }
    }

    // Personal tasks owned by the user, in the date range
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
      .populate('board', 'name visibility')
      .sort({ dueDate: 1, createdAt: 1 });

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
 *   - Board task: requires `board` and `group`. Admin only.
 *   - Personal task: `isPersonal: true`, no board/group. Any user.
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
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Personal task path
    if (isPersonal) {
      const task = await Task.create({
        name: name.trim(),
        priority: priority || 'medium',
        status: status || 'not_started',
        dueDate: dueDate || undefined,
        note: note || undefined,
        isPersonal: true,
        createdBy: userId,
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

    // Group must belong to this board
    const group = await TaskGroup.findById(groupId);
    if (!group || group.board.toString() !== boardId) {
      return res.status(400).json({ error: 'Group does not belong to board' });
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
      status: status || 'not_started',
      assignedTo: assigneeIds,
      dueDate: dueDate || undefined,
      note: note || undefined,
      isPersonal: false,
      createdBy: userId,
    });

    // Touch the board's updatedAt so "recent boards" reflects activity
    await Board.updateOne({ _id: boardId }, { $set: { updatedAt: new Date() } });

    // Notify each assignee that they've been assigned a new task
    if (assigneeIds.length > 0) {
      await createNotificationsForUsers({
        userIds: assigneeIds,
        type: 'assigned',
        message: `You were assigned to "${task.name}"`,
        taskId: task._id,
        excludeUserId: userId,
      });
    }

    // Send email notifications to each assignee
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
 *
 * Update a task.
 *   - Personal task: only the creator can edit, and can edit any field.
 *   - Board task (admin): can update any field.
 *   - Board task (regular user): can only update `status`, and only if they
 *     are an assignee of the task.
 */
const updateTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const body = req.body || {};

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Personal task branch
    if (task.isPersonal) {
      if (!task.createdBy || task.createdBy.toString() !== userId) {
        return res.status(403).json({ error: 'Not authorised' });
      }
      if (typeof body.name === 'string') {
        if (!body.name.trim()) {
          return res.status(400).json({ error: 'Task name cannot be empty' });
        }
        task.name = body.name.trim();
      }
      if (body.priority !== undefined) {
        if (!VALID_PRIORITIES.includes(body.priority)) {
          return res.status(400).json({ error: 'Invalid priority' });
        }
        task.priority = body.priority;
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        task.status = body.status;
      }
      if (body.dueDate !== undefined) {
        task.dueDate = body.dueDate || undefined;
      }
      if (body.note !== undefined) {
        task.note = body.note || undefined;
      }
      await task.save();
      const populated = await populateTask(Task.findById(task._id));
      return res.json({ task: populated });
    }

    // Board task branch — need board context for permissions
    const ctx = await loadBoardContext(task.board, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

    if (!ctx.isAdmin) {
      // Regular users can only change status, only if they're assigned,
      // and only on public boards
      if (ctx.board.visibility !== 'public') {
        return res.status(403).json({ error: 'Board not accessible' });
      }
      const isAssignee = task.assignedTo.some((u) => u.toString() === userId);
      if (!isAssignee) {
        return res.status(403).json({ error: 'Not authorised' });
      }
      const allowedKeys = Object.keys(body).filter((k) => body[k] !== undefined);
      if (allowedKeys.length !== 1 || allowedKeys[0] !== 'status') {
        return res
          .status(403)
          .json({ error: 'Only status can be changed by assignees' });
      }
      if (!VALID_STATUSES.includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const prevStatus = task.status;
      task.status = body.status;
      await task.save();

      // Notify other assignees that the status changed
      if (prevStatus !== body.status) {
        await createNotificationsForUsers({
          userIds: task.assignedTo,
          type: 'statusChanged',
          message: `Status of "${task.name}" changed to ${body.status.replace(/_/g, ' ')}`,
          taskId: task._id,
          excludeUserId: userId,
        });
      }

      const populated = await populateTask(Task.findById(task._id));
      return res.json({ task: populated });
    }

    // Admin: can update any field
    // Capture "before" values so we can diff and fire the right notifications
    const prevStatus = task.status;
    const prevAssigneeIds = task.assignedTo.map((u) => u.toString());
    let statusChanged = false;
    let newAssigneeIds = null; // ids added this update
    if (typeof body.name === 'string') {
      if (!body.name.trim()) {
        return res.status(400).json({ error: 'Task name cannot be empty' });
      }
      task.name = body.name.trim();
    }
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      task.priority = body.priority;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      if (prevStatus !== body.status) statusChanged = true;
      task.status = body.status;
    }
    if (body.assignedTo !== undefined) {
      const { ids, error: assigneeErr } = validateAssignees(
        body.assignedTo,
        ctx.org
      );
      if (assigneeErr) return res.status(400).json({ error: assigneeErr });
      const prevSet = new Set(prevAssigneeIds);
      newAssigneeIds = ids.filter((id) => !prevSet.has(id));
      task.assignedTo = ids;
    }
    if (body.dueDate !== undefined) {
      task.dueDate = body.dueDate || undefined;
    }
    if (body.note !== undefined) {
      task.note = body.note || undefined;
    }
    if (body.group !== undefined && body.group !== null) {
      const newGroup = await TaskGroup.findById(body.group);
      if (!newGroup || newGroup.board.toString() !== task.board.toString()) {
        return res
          .status(400)
          .json({ error: 'Group does not belong to board' });
      }
      task.group = body.group;
    }

    await task.save();
    await Board.updateOne(
      { _id: task.board },
      { $set: { updatedAt: new Date() } }
    );

    // Notify newly-added assignees
    if (newAssigneeIds && newAssigneeIds.length > 0) {
      await createNotificationsForUsers({
        userIds: newAssigneeIds,
        type: 'assigned',
        message: `You were assigned to "${task.name}"`,
        taskId: task._id,
        excludeUserId: userId,
      });
    }
    // Notify current assignees (except actor) that status changed
    if (statusChanged) {
      await createNotificationsForUsers({
        userIds: task.assignedTo,
        type: 'statusChanged',
        message: `Status of "${task.name}" changed to ${task.status.replace(/_/g, ' ')}`,
        taskId: task._id,
        excludeUserId: userId,
      });
    }

    // Send email to newly-added assignees
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
 * DELETE /api/tasks/:id
 *
 * Admin only for board tasks. For personal tasks, only the creator can delete.
 * Also cascades comments attached to the task.
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

    await Comment.deleteMany({ task: id });
    await Task.deleteOne({ _id: id });

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getTasks,
  getMyTasks,
  getCalendarTasks,
  createTask,
  updateTask,
  deleteTask,
};
