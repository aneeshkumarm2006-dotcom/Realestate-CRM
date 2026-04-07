const User = require('../models/User');
const Organisation = require('../models/Organisation');
const Board = require('../models/Board');
const TaskGroup = require('../models/TaskGroup');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

/**
 * PUT /api/profile — Update the current user's display name.
 */
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name: name.trim() },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/profile/upload-avatar — Upload a new profile picture.
 * Multer + Cloudinary have already uploaded and transformed the image.
 * Here we just persist the resulting URL to the user record.
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // multer-storage-cloudinary stores the Cloudinary URL on req.file.path
    const url = req.file.path || req.file.secure_url;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePic: url },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user, profilePic: url });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/profile — Permanently delete the current user's account.
 *
 * Cascade:
 *  - Orgs where user is the primary admin → delete org + all boards, groups,
 *    tasks, comments, and notifications inside them.
 *  - Orgs where user is only a member/extra-admin → remove from members/admins.
 *  - Personal tasks created by the user → deleted with their comments/notifications.
 *  - User removed from assignedTo on all remaining tasks.
 *  - All comments authored by the user → deleted.
 *  - All notifications addressed to the user → deleted.
 *  - User document → deleted.
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    // ── 1. Orgs where this user is the primary admin ──────────────────────
    const adminOrgs = await Organisation.find({ admin: userId }).select('_id');
    for (const org of adminOrgs) {
      const boardIds = await Board.distinct('_id', { organisation: org._id });
      const taskIds = await Task.distinct('_id', { board: { $in: boardIds } });

      await Comment.deleteMany({ task: { $in: taskIds } });
      await Notification.deleteMany({ task: { $in: taskIds } });
      await Task.deleteMany({ board: { $in: boardIds } });
      await TaskGroup.deleteMany({ board: { $in: boardIds } });
      await Board.deleteMany({ organisation: org._id });
      await Organisation.deleteOne({ _id: org._id });
    }

    // ── 2. Remove user from orgs they are only a member / extra-admin of ──
    await Organisation.updateMany(
      { members: userId },
      { $pull: { members: userId, admins: userId } }
    );

    // ── 3. Personal tasks this user created ───────────────────────────────
    const personalTaskIds = await Task.distinct('_id', {
      isPersonal: true,
      createdBy: userId,
    });
    if (personalTaskIds.length) {
      await Comment.deleteMany({ task: { $in: personalTaskIds } });
      await Notification.deleteMany({ task: { $in: personalTaskIds } });
      await Task.deleteMany({ _id: { $in: personalTaskIds } });
    }

    // ── 4. Remove user from assignedTo on any remaining tasks ────────────
    await Task.updateMany({ assignedTo: userId }, { $pull: { assignedTo: userId } });

    // ── 5. Delete comments authored by the user ───────────────────────────
    await Comment.deleteMany({ author: userId });

    // ── 6. Delete all notifications sent to the user ─────────────────────
    await Notification.deleteMany({ user: userId });

    // ── 7. Delete the user document ───────────────────────────────────────
    await User.findByIdAndDelete(userId);

    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('deleteAccount error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  updateProfile,
  uploadAvatar,
  deleteAccount,
};
