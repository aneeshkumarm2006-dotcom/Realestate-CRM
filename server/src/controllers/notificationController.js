const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Task = require('../models/Task');

const NOTIFICATION_LIMIT = 50;
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Scan for tasks assigned to the given user whose due date lands inside the
 * next 24 hours and create a `dueSoon` notification for each task that
 * doesn't already have one. Personal tasks created by the user are also
 * included.
 *
 * This runs on every GET /api/notifications call (poll-based, no cron).
 * Failures are swallowed so they never break the list fetch.
 */
const ensureDueSoonNotifications = async (userId) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const dueTasks = await Task.find({
      dueDate: { $gte: now, $lte: soon },
      $or: [
        { assignedTo: userObjectId },
        { isPersonal: true, createdBy: userObjectId },
      ],
    }).select('_id name dueDate');

    if (!dueTasks.length) return;

    const taskIds = dueTasks.map((t) => t._id);
    const existing = await Notification.find({
      user: userObjectId,
      type: 'dueSoon',
      task: { $in: taskIds },
    }).select('task');
    const existingSet = new Set(existing.map((n) => n.task.toString()));

    const toCreate = dueTasks
      .filter((t) => !existingSet.has(t._id.toString()))
      .map((t) => ({
        user: userObjectId,
        type: 'dueSoon',
        message: `"${t.name}" is due soon`,
        task: t._id,
        isRead: false,
      }));

    if (toCreate.length) {
      await Notification.insertMany(toCreate);
    }
  } catch (err) {
    console.error('ensureDueSoonNotifications error:', err);
  }
};

/**
 * GET /api/notifications
 *
 * Return the latest 50 notifications for the current user, newest first.
 * Also runs an inline due-soon scan so users see reminders for tasks due
 * within the next 24 hours.
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    await ensureDueSoonNotifications(userId);

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_LIMIT)
      .populate('task', 'board');

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/notifications/:id/read
 *
 * Mark one notification as read. Must belong to the current user.
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const notif = await Notification.findOne({ _id: id, user: userId });
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notif.isRead = true;
    await notif.save();
    return res.json({ notification: notif });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/notifications/read-all
 *
 * Bulk mark every unread notification for the current user as read.
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );
    return res.json({ success: true, updated: result.modifiedCount });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
