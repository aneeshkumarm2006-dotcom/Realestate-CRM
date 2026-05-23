const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Organisation the notification belongs to. Null/undefined for personal-task
  // notifications (dueSoon on isPersonal tasks) — those are shown regardless of
  // the user's currently selected org since they don't live in any workspace.
  organisation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    default: null,
    index: true,
  },
  type: {
    type: String,
    enum: ['assigned', 'commented', 'mentioned', 'statusChanged', 'dueSoon'],
  },
  message: {
    type: String,
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
