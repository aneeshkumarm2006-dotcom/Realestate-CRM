const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  text: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Comment', commentSchema);
