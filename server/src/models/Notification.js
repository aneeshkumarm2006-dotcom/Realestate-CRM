const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
