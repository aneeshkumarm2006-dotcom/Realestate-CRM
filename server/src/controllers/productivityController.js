const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');
const Organisation = require('../models/Organisation');

const VALID_RANGES = ['7d', '30d', 'all'];

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
 * GET /api/productivity?org=:orgId&range=:range
 *
 * Admin-only. Returns per-member productivity stats for the organisation:
 *   - members: [{ user, total, done, inProgress, notStarted, stuck, overdue,
 *                 dueSoon, completionRate, currentTasks }]
 *   - summary: org-wide totals
 *
 * `range` filters by Task.createdAt for total/done/breakdown counts. Overdue
 * and "current tasks" are always evaluated against today regardless of range.
 */
const getProductivity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orgId = req.query.org;
    const range = VALID_RANGES.includes(req.query.range)
      ? req.query.range
      : '30d';

    if (!orgId) {
      return res.status(400).json({ error: 'Organisation ID required' });
    }

    const org = await Organisation.findById(orgId)
      .populate('members', 'name email profilePic');
    if (!org) return res.status(404).json({ error: 'Organisation not found' });

    const isAdmin =
      (org.admin && org.admin.toString() === userId) ||
      (Array.isArray(org.admins) && org.admins.some((a) => a.toString() === userId));
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Boards in org
    const orgBoards = await Board.find({ organisation: orgId }).select('_id name');
    const orgBoardIds = orgBoards.map((b) => b._id);
    const boardNameById = new Map(
      orgBoards.map((b) => [b._id.toString(), b.name])
    );

    const since = rangeToSince(range);
    const baseFilter = { board: { $in: orgBoardIds } };

    const now = new Date();
    const dueSoonCutoff = new Date(now);
    dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 3);

    // Open task counts (notStarted/inProgress/stuck/overdue/dueSoon) reflect
    // current workload — not bounded by range. Done count IS bounded by
    // range so the period filter measures recent throughput.
    const openMatch = { ...baseFilter, status: { $ne: 'done' } };
    const doneMatch = { ...baseFilter, status: 'done' };
    if (since) doneMatch.updatedAt = { $gte: since };

    const [openAgg, doneAgg, currentTasksByUser] = await Promise.all([
      Task.aggregate([
        { $match: openMatch },
        { $unwind: '$assignedTo' },
        {
          $group: {
            _id: '$assignedTo',
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'working_on_it'] }, 1, 0] },
            },
            notStarted: {
              $sum: { $cond: [{ $eq: ['$status', 'not_started'] }, 1, 0] },
            },
            stuck: {
              $sum: { $cond: [{ $eq: ['$status', 'stuck'] }, 1, 0] },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$dueDate', null] },
                      { $lt: ['$dueDate', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            dueSoon: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$dueDate', null] },
                      { $gte: ['$dueDate', now] },
                      { $lte: ['$dueDate', dueSoonCutoff] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Task.aggregate([
        { $match: doneMatch },
        { $unwind: '$assignedTo' },
        {
          $group: {
            _id: '$assignedTo',
            done: { $sum: 1 },
          },
        },
      ]),
      // Current tasks: NOT done, regardless of range, top 5 by dueDate asc
      Task.aggregate([
        {
          $match: {
            ...baseFilter,
            status: { $ne: 'done' },
          },
        },
        { $unwind: '$assignedTo' },
        {
          $sort: {
            dueDate: 1,
            updatedAt: -1,
          },
        },
        {
          $group: {
            _id: '$assignedTo',
            tasks: {
              $push: {
                _id: '$_id',
                name: '$name',
                status: '$status',
                priority: '$priority',
                dueDate: '$dueDate',
                board: '$board',
              },
            },
          },
        },
        {
          $project: {
            tasks: { $slice: ['$tasks', 5] },
          },
        },
      ]),
    ]);

    const openByUser = new Map(
      openAgg.map((r) => [r._id.toString(), r])
    );
    const doneByUser = new Map(
      doneAgg.map((r) => [r._id.toString(), r.done])
    );
    const tasksByUser = new Map(
      currentTasksByUser.map((r) => [r._id.toString(), r.tasks])
    );

    const adminIdSet = new Set(
      [
        org.admin ? org.admin.toString() : null,
        ...((org.admins || []).map((a) => a.toString())),
      ].filter(Boolean)
    );
    const ownerId = org.admin ? org.admin.toString() : null;

    const members = (org.members || []).map((m) => {
      const id = m._id.toString();
      const open = openByUser.get(id) || {};
      const done = doneByUser.get(id) || 0;
      const inProgress = open.inProgress || 0;
      const notStarted = open.notStarted || 0;
      const stuck = open.stuck || 0;
      const overdue = open.overdue || 0;
      const dueSoon = open.dueSoon || 0;
      const total = done + inProgress + notStarted + stuck;
      const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);
      const currentTasks = (tasksByUser.get(id) || []).map((t) => ({
        _id: t._id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        boardId: t.board,
        boardName: boardNameById.get(t.board.toString()) || '',
      }));

      let role = 'member';
      if (id === ownerId) role = 'owner';
      else if (adminIdSet.has(id)) role = 'admin';

      return {
        user: {
          _id: m._id,
          name: m.name,
          email: m.email,
          profilePic: m.profilePic,
        },
        role,
        total,
        done,
        inProgress,
        notStarted,
        stuck,
        overdue,
        dueSoon,
        completionRate,
        currentTasks,
      };
    });

    // Sort: most active first (total desc), then by name asc
    members.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return (a.user.name || '').localeCompare(b.user.name || '');
    });

    const summary = members.reduce(
      (acc, m) => {
        acc.totalAssignments += m.total;
        acc.totalDone += m.done;
        acc.totalOverdue += m.overdue;
        acc.totalInProgress += m.inProgress;
        return acc;
      },
      {
        memberCount: members.length,
        totalAssignments: 0,
        totalDone: 0,
        totalOverdue: 0,
        totalInProgress: 0,
      }
    );
    summary.avgCompletionRate =
      summary.totalAssignments === 0
        ? 0
        : Math.round((summary.totalDone / summary.totalAssignments) * 100);

    return res.json({
      summary,
      members,
      filters: { range },
    });
  } catch (err) {
    console.error('getProductivity error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getProductivity,
};
