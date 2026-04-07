const Board = require('../models/Board');
const Task = require('../models/Task');
const TaskGroup = require('../models/TaskGroup');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Organisation = require('../models/Organisation');

const VALID_VISIBILITIES = ['public', 'private'];

/**
 * Resolve whether the current user is the admin of the given org.
 */
const isOrgAdmin = (org, userId) =>
  !!org &&
  (
    (org.admin && org.admin.toString() === userId) ||
    (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId))
  );

/**
 * Confirm the user is a member of the org. Returns the org doc or null.
 */
const loadOrgForMember = async (orgId, userId) => {
  const org = await Organisation.findById(orgId);
  if (!org) return { org: null, isMember: false };
  const isMember = org.members.some((m) => m.toString() === userId);
  return { org, isMember };
};

/**
 * GET /api/boards?org=:orgId
 *
 * All org members can see all boards. Sorted by updatedAt desc.
 */
const getBoards = async (req, res) => {
  try {
    const orgId = req.query.org;
    if (!orgId) {
      return res.status(400).json({ error: 'Organisation ID required' });
    }

    const userId = req.user.userId;
    const { org, isMember } = await loadOrgForMember(orgId, userId);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }

    // All org members (admin or regular) can see all boards in the org
    const boards = await Board.find({ organisation: orgId })
      .sort({ updatedAt: -1 });
    return res.json({ boards });
  } catch (err) {
    console.error('getBoards error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/dashboard/stats?org=:orgId
 *
 * Returns: { totalBoards, completedTasks, pendingTasks, completionRate }
 * Admins see org-wide stats. Regular users see stats scoped to tasks they
 * are assigned to within the org's public boards.
 */
const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.query.org;
    if (!orgId) {
      return res.status(400).json({ error: 'Organisation ID required' });
    }

    const userId = req.user.userId;
    const { org, isMember } = await loadOrgForMember(orgId, userId);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }

    // All org members see org-wide stats
    const orgBoardIds = await Board.distinct('_id', { organisation: orgId });

    const taskFilter = { board: { $in: orgBoardIds } };

    const [completedTasks, pendingTasks, totalBoards] = await Promise.all([
      Task.countDocuments({ ...taskFilter, status: 'done' }),
      Task.countDocuments({ ...taskFilter, status: { $ne: 'done' } }),
      Board.countDocuments({ organisation: orgId }),
    ]);

    const totalTasks = completedTasks + pendingTasks;
    const completionRate =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return res.json({
      totalBoards,
      completedTasks,
      pendingTasks,
      completionRate,
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/boards
 *
 * Body: { name, visibility, organisation }
 * Admin-only. Validates input, attaches orgId and createdBy.
 */
const createBoard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      visibility = 'private',
      organisation,
      description = '',
    } = req.body;

    if (!organisation) {
      return res.status(400).json({ error: 'Organisation ID required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Board name is required' });
    }
    if (!VALID_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value' });
    }

    const org = await Organisation.findById(organisation);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    if (!isOrgAdmin(org, userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const board = await Board.create({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      visibility,
      organisation,
      createdBy: userId,
    });

    return res.status(201).json({ board });
  } catch (err) {
    console.error('createBoard error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/boards/:id
 *
 * Body: { name?, visibility? }
 * Admin-only for the owning org.
 */
const updateBoard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, visibility, description } = req.body;

    const board = await Board.findById(id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const org = await Organisation.findById(board.organisation);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    if (!isOrgAdmin(org, userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (typeof name === 'string') {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Board name cannot be empty' });
      }
      board.name = name.trim();
    }
    if (typeof visibility === 'string') {
      if (!VALID_VISIBILITIES.includes(visibility)) {
        return res.status(400).json({ error: 'Invalid visibility value' });
      }
      board.visibility = visibility;
    }
    if (typeof description === 'string') {
      board.description = description.trim();
    }

    await board.save();
    return res.json({ board });
  } catch (err) {
    console.error('updateBoard error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/boards/:id
 *
 * Admin-only. Cascade deletes all TaskGroups, Tasks and Comments belonging
 * to this board.
 */
const deleteBoard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const board = await Board.findById(id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const org = await Organisation.findById(board.organisation);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    if (!isOrgAdmin(org, userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Cascade: find all tasks on this board, delete their comments, then
    // delete the tasks, then delete the groups, then the board itself.
    const taskIds = await Task.distinct('_id', { board: id });
    if (taskIds.length > 0) {
      await Comment.deleteMany({ task: { $in: taskIds } });
      await Notification.deleteMany({ task: { $in: taskIds } });
    }
    await Task.deleteMany({ board: id });
    await TaskGroup.deleteMany({ board: id });
    await Board.deleteOne({ _id: id });

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteBoard error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getBoards,
  getDashboardStats,
  createBoard,
  updateBoard,
  deleteBoard,
};
