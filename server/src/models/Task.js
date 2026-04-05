const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskGroup',
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['not_started', 'working_on_it', 'done', 'stuck'],
      default: 'not_started',
    },
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    dueDate: {
      type: Date,
    },
    note: {
      type: String,
    },
    isPersonal: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
