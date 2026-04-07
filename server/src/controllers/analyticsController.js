const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');
const Organisation = require('../models/Organisation');

const STATUSES = ['not_started', 'working_on_it', 'done', 'stuck'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_RANGES = ['7d', '30d', 'all'];

/**
 * Convert a range string into a Date floor, or null for "all".
 */
const rangeToSince = (range) => {
  const now = new Date();
  if (range === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
};

/**
 * GET /api/analytics?org=:orgId&board=:boardId&range=:range
 *
 * Admin-only. Returns aggregated analytics for the org:
 *   - summary: totalTasks, completionRate, overdueTasks, activeBoards
 *   - statusDistribution: { status, count }[]
 *   - priorityDistribution: { priority, count }[]
 *   - boardPerformance: { _id, name, total, done, percent }[]
 *
 * Filters:
 *   board  — specific board id, or "all"/omitted for all boards in org
 *   range  — "7d" | "30d" | "all"  (filters by Task.createdAt)
 */
const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orgId = req.query.org;
    const boardFilter = req.query.board && req.query.board !== 'all'
      ? req.query.board
      : null;
    const range = VALID_RANGES.includes(req.query.range)
      ? req.query.range
      : '30d';

    if (!orgId) {
      return res.status(400).json({ error: 'Organisation ID required' });
    }

    const org = await Organisation.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    const isAdmin =
      (org.admin && org.admin.toString() === userId) ||
      (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId));
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Boards in org (for scoping + performance list)
    const orgBoards = await Board.find({ organisation: orgId })
      .select('_id name')
      .sort({ createdAt: 1 });
    const orgBoardIds = orgBoards.map((b) => b._id);

    // Validate requested board belongs to org, if provided
    let scopedBoardIds = orgBoardIds;
    if (boardFilter) {
      if (!mongoose.Types.ObjectId.isValid(boardFilter)) {
        return res.status(400).json({ error: 'Invalid board id' });
      }
      const match = orgBoardIds.find((id) => id.toString() === boardFilter);
      if (!match) {
        return res.status(404).json({ error: 'Board not found in organisation' });
      }
      scopedBoardIds = [match];
    }

    const since = rangeToSince(range);
    const taskFilter = {
      board: { $in: scopedBoardIds },
    };
    if (since) {
      taskFilter.createdAt = { $gte: since };
    }

    // Run the aggregate pipelines in parallel
    const [statusAgg, priorityAgg, overdueCount, perBoardAgg, totalTasks] =
      await Promise.all([
        Task.aggregate([
          { $match: taskFilter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Task.aggregate([
          { $match: taskFilter },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        Task.countDocuments({
          ...taskFilter,
          status: { $ne: 'done' },
          dueDate: { $ne: null, $lt: new Date() },
        }),
        Task.aggregate([
          { $match: taskFilter },
          {
            $group: {
              _id: '$board',
              total: { $sum: 1 },
              done: {
                $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] },
              },
            },
          },
        ]),
        Task.countDocuments(taskFilter),
      ]);

    // Fill in zeros for all enum buckets so the UI renders every row
    const statusMap = Object.fromEntries(statusAgg.map((r) => [r._id, r.count]));
    const statusDistribution = STATUSES.map((status) => ({
      status,
      count: statusMap[status] || 0,
    }));

    const priorityMap = Object.fromEntries(
      priorityAgg.map((r) => [r._id, r.count])
    );
    const priorityDistribution = PRIORITIES.map((priority) => ({
      priority,
      count: priorityMap[priority] || 0,
    }));

    // Active boards = boards in scope that have at least one task in-range
    const perBoardMap = new Map(
      perBoardAgg.map((r) => [r._id.toString(), r])
    );
    const boardPerformance = orgBoards
      .filter((b) => scopedBoardIds.some((id) => id.toString() === b._id.toString()))
      .map((b) => {
        const stat = perBoardMap.get(b._id.toString());
        const total = stat?.total || 0;
        const done = stat?.done || 0;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        return {
          _id: b._id,
          name: b.name,
          total,
          done,
          percent,
        };
      });

    const activeBoards = boardPerformance.filter((b) => b.total > 0).length;
    const doneTotal = statusMap.done || 0;
    const completionRate =
      totalTasks === 0 ? 0 : Math.round((doneTotal / totalTasks) * 100);

    return res.json({
      summary: {
        totalTasks,
        completionRate,
        overdueTasks: overdueCount,
        activeBoards,
      },
      statusDistribution,
      priorityDistribution,
      boardPerformance,
      boards: orgBoards.map((b) => ({ _id: b._id, name: b.name })),
      filters: {
        board: boardFilter || 'all',
        range,
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAnalytics,
};
