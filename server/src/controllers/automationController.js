const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');
const TaskGroup = require('../models/TaskGroup');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const Automation = require('../models/Automation');
const {
  createNotificationsForUsers,
} = require('../services/notificationService');
const { sendTaskAssignmentEmail } = require('../services/emailService');
const {
  computeNextRunAt,
  validateSchedule,
} = require('../services/automationSchedule');

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const DAY_MS = 24 * 60 * 60 * 1000;

const isOrgAdmin = (org, userId) =>
  !!org &&
  (
    (org.admin && org.admin.toString() === userId) ||
    (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId))
  );

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

const populateAutomation = (query) =>
  query
    .populate('taskTemplate.group', 'name')
    .populate('taskTemplate.assignedTo', 'name profilePic email')
    .populate('createdBy', 'name profilePic email');

const sanitizeSchedule = (raw) => {
  const s = {
    frequency: raw?.frequency,
    hour: Number.isInteger(raw?.hour) ? raw.hour : 9,
    timezone: raw?.timezone || 'UTC',
  };
  if (s.frequency === 'weekly') {
    s.daysOfWeek = Array.isArray(raw?.daysOfWeek)
      ? raw.daysOfWeek
          .map((d) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [];
  }
  if (s.frequency === 'monthly') {
    s.dayOfMonth = Number(raw?.dayOfMonth);
  }
  return s;
};

/**
 * Run an automation once: spawn a Task using the template and fire the same
 * notification + email side effects a manual create would. Returns the task.
 */
const runAutomationOnce = async (automation) => {
  const tpl = automation.taskTemplate;
  const now = new Date();
  const dueDate =
    Number.isFinite(tpl.dueInDays) && tpl.dueInDays !== null
      ? new Date(now.getTime() + tpl.dueInDays * DAY_MS)
      : undefined;

  const assigneeIds = (tpl.assignedTo || []).map((u) => u.toString());

  const task = await Task.create({
    name: tpl.name,
    board: automation.board,
    group: tpl.group,
    priority: tpl.priority || 'medium',
    status: 'not_started',
    assignedTo: assigneeIds,
    dueDate,
    note: tpl.note || undefined,
    isPersonal: false,
    createdBy: automation.createdBy,
  });

  await Board.updateOne(
    { _id: automation.board },
    { $set: { updatedAt: new Date() } }
  );

  if (assigneeIds.length > 0) {
    await createNotificationsForUsers({
      userIds: assigneeIds,
      type: 'assigned',
      message: `You were assigned to "${task.name}"`,
      taskId: task._id,
    });

    const taskLink = `${process.env.CLIENT_URL}/boards/${automation.board}`;
    const assigneeUsers = await User.find({ _id: { $in: assigneeIds } })
      .select('email')
      .lean();
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
        console.error(
          `[email] Failed to send to ${assigneeUsers[i]?.email}:`,
          result.reason?.message || result.reason
        );
      }
    });
  }

  return task;
};

/**
 * GET /api/boards/:boardId/automations
 */
const listAutomations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;

    const ctx = await loadBoardContext(boardId, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const automations = await populateAutomation(
      Automation.find({ board: boardId })
    ).sort({ createdAt: -1 });

    return res.json({ automations });
  } catch (err) {
    console.error('listAutomations error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/boards/:boardId/automations
 */
const createAutomation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const body = req.body || {};

    const ctx = await loadBoardContext(boardId, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ error: 'Automation name is required' });
    }

    const schedule = sanitizeSchedule(body.schedule);
    const sv = validateSchedule(schedule);
    if (!sv.valid) return res.status(400).json({ error: sv.error });

    const tpl = body.taskTemplate || {};
    if (!tpl.name || !String(tpl.name).trim()) {
      return res.status(400).json({ error: 'Template task name is required' });
    }
    if (!tpl.group || !mongoose.Types.ObjectId.isValid(tpl.group)) {
      return res.status(400).json({ error: 'Template group is required' });
    }
    const group = await TaskGroup.findById(tpl.group);
    if (!group || group.board.toString() !== boardId) {
      return res.status(400).json({ error: 'Group does not belong to board' });
    }
    if (tpl.priority && !VALID_PRIORITIES.includes(tpl.priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    const { ids: assigneeIds, error: assigneeErr } = validateAssignees(
      tpl.assignedTo,
      ctx.org
    );
    if (assigneeErr) return res.status(400).json({ error: assigneeErr });

    let dueInDays = null;
    if (tpl.dueInDays !== undefined && tpl.dueInDays !== null && tpl.dueInDays !== '') {
      const n = Number(tpl.dueInDays);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'dueInDays must be a non-negative number' });
      }
      dueInDays = n;
    }

    const nextRunAt = computeNextRunAt(schedule, new Date());

    const automation = await Automation.create({
      name: String(body.name).trim(),
      board: boardId,
      organisation: ctx.board.organisation,
      enabled: body.enabled !== false,
      schedule,
      taskTemplate: {
        name: String(tpl.name).trim(),
        group: tpl.group,
        priority: tpl.priority || 'medium',
        assignedTo: assigneeIds,
        note: tpl.note ? String(tpl.note) : undefined,
        dueInDays,
      },
      nextRunAt,
      createdBy: userId,
    });

    const populated = await populateAutomation(Automation.findById(automation._id));
    return res.status(201).json({ automation: populated });
  } catch (err) {
    console.error('createAutomation error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/automations/:id
 */
const updateAutomation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const body = req.body || {};

    const automation = await Automation.findById(id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });

    const ctx = await loadBoardContext(automation.board, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let scheduleChanged = false;
    let enabledChanged = false;

    if (typeof body.name === 'string') {
      if (!body.name.trim()) {
        return res.status(400).json({ error: 'Automation name cannot be empty' });
      }
      automation.name = body.name.trim();
    }

    if (body.enabled !== undefined) {
      const next = !!body.enabled;
      if (next !== automation.enabled) enabledChanged = true;
      automation.enabled = next;
    }

    if (body.schedule !== undefined) {
      const schedule = sanitizeSchedule(body.schedule);
      const sv = validateSchedule(schedule);
      if (!sv.valid) return res.status(400).json({ error: sv.error });
      automation.schedule = schedule;
      scheduleChanged = true;
    }

    if (body.taskTemplate !== undefined) {
      const tpl = body.taskTemplate || {};
      if (!tpl.name || !String(tpl.name).trim()) {
        return res.status(400).json({ error: 'Template task name is required' });
      }
      if (!tpl.group || !mongoose.Types.ObjectId.isValid(tpl.group)) {
        return res.status(400).json({ error: 'Template group is required' });
      }
      const group = await TaskGroup.findById(tpl.group);
      if (!group || group.board.toString() !== automation.board.toString()) {
        return res.status(400).json({ error: 'Group does not belong to board' });
      }
      if (tpl.priority && !VALID_PRIORITIES.includes(tpl.priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      const { ids: assigneeIds, error: assigneeErr } = validateAssignees(
        tpl.assignedTo,
        ctx.org
      );
      if (assigneeErr) return res.status(400).json({ error: assigneeErr });

      let dueInDays = null;
      if (tpl.dueInDays !== undefined && tpl.dueInDays !== null && tpl.dueInDays !== '') {
        const n = Number(tpl.dueInDays);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: 'dueInDays must be a non-negative number' });
        }
        dueInDays = n;
      }

      automation.taskTemplate = {
        name: String(tpl.name).trim(),
        group: tpl.group,
        priority: tpl.priority || 'medium',
        assignedTo: assigneeIds,
        note: tpl.note ? String(tpl.note) : undefined,
        dueInDays,
      };
    }

    if (scheduleChanged || enabledChanged) {
      automation.nextRunAt = automation.enabled
        ? computeNextRunAt(automation.schedule, new Date())
        : null;
    }

    await automation.save();
    const populated = await populateAutomation(Automation.findById(automation._id));
    return res.json({ automation: populated });
  } catch (err) {
    console.error('updateAutomation error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/automations/:id
 */
const deleteAutomation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const automation = await Automation.findById(id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });

    const ctx = await loadBoardContext(automation.board, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await Automation.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteAutomation error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/automations/:id/run-now
 */
const runAutomationNow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const automation = await Automation.findById(id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });

    const ctx = await loadBoardContext(automation.board, userId);
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const task = await runAutomationOnce(automation);
    automation.lastRunAt = new Date();
    await automation.save();

    const populated = await populateAutomation(Automation.findById(automation._id));
    return res.json({ automation: populated, taskId: task._id });
  } catch (err) {
    console.error('runAutomationNow error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationNow,
  runAutomationOnce,
};
