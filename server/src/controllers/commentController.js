const Task = require('../models/Task');
const Board = require('../models/Board');
const Comment = require('../models/Comment');
const Organisation = require('../models/Organisation');
const {
  createNotificationsForUsers,
} = require('../services/notificationService');

/**
 * Check if a user has read access to the given task. Returns
 * { ok: true } on success, or { status, error } on failure.
 *
 * Rules (mirrors taskController access):
 *   - Personal task: only the creator can read.
 *   - Board task (admin of the board's org): always.
 *   - Board task (regular member): only on public boards AND only when the
 *     user is an assignee of the task.
 */
const checkTaskAccess = async (task, userId) => {
  // Personal task — only the creator can access
  if (task.isPersonal) {
    if (!task.createdBy || task.createdBy.toString() !== userId) {
      return { status: 403, error: 'Not authorised' };
    }
    return { ok: true };
  }

  // Board task — need board + org context
  const board = await Board.findById(task.board);
  if (!board) return { status: 404, error: 'Board not found' };

  const org = await Organisation.findById(board.organisation);
  if (!org) return { status: 404, error: 'Organisation not found' };

  const isMember = org.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { status: 403, error: 'Not a member of this organisation' };
  }

  // Any org member can access board task comments
  return { ok: true };
};

/**
 * GET /api/tasks/:taskId/comments
 *
 * List comments for a task, populated with author (name, profilePic),
 * sorted oldest-first (chronological).
 */
const getComments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await checkTaskAccess(task, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const comments = await Comment.find({ task: taskId })
      .populate('author', 'name profilePic email')
      .sort({ createdAt: 1 });

    return res.json({ comments });
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/tasks/:taskId/comments
 *
 * Add a comment on a task. The current user is attached as the author.
 * Body: { text: string }
 */
const addComment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await checkTaskAccess(task, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const comment = await Comment.create({
      task: taskId,
      author: userId,
      text: text.trim(),
    });

    const populated = await Comment.findById(comment._id).populate(
      'author',
      'name profilePic email'
    );

    // Notify task assignees (except the commenter) about the new comment.
    // Personal tasks have no other assignees — they're skipped naturally.
    if (!task.isPersonal && Array.isArray(task.assignedTo)) {
      const authorName = populated.author?.name || 'Someone';
      await createNotificationsForUsers({
        userIds: task.assignedTo,
        type: 'commented',
        message: `${authorName} commented on "${task.name}"`,
        taskId: task._id,
        excludeUserId: userId,
      });
    }

    return res.status(201).json({ comment: populated });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getComments,
  addComment,
};
