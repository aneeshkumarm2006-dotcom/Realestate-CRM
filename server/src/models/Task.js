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
    order: { type: Number, default: 0, index: true },
    // Board tasks: ObjectId referencing Board.statuses._id.
    // Personal tasks: legacy enum string ('not_started', 'working_on_it',
    // 'done', 'stuck') — kept as strings because personal tasks don't have
    // a board to read statuses from. Mixed type accepts both shapes;
    // taskController validates per-context.
    status: {
      type: mongoose.Schema.Types.Mixed,
      default: 'not_started',
    },
    // Board tasks: ObjectIds referencing Board.labels._id.
    // Personal tasks: empty array (labels are board-scoped).
    labels: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    checklist: {
      type: [
        new mongoose.Schema(
          {
            text: { type: String, default: '' },
            done: { type: Boolean, default: false },
          },
          { timestamps: { createdAt: true, updatedAt: false } }
        ),
      ],
      default: [],
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
    // Subitems: when set, this task is a child of another Task on the same
    // board. Top-level tasks (the rows shown in TaskTable) have parent: null.
    // Indexed so the subitems lookup `find({ parent: id })` is cheap.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    // Loop guard for ITEM_CREATED automations: when an automation creates a
    // task via CREATE_TASK or CREATE_SUBITEM, the task is tagged so the
    // dispatcher can skip it and avoid recursive trigger loops.
    createdByAutomation: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Files attached directly to the task (uploaded via the Files tab).
    // Mirrors the Update.attachments shape so the FE can share UI.
    attachments: {
      type: [
        new mongoose.Schema(
          {
            url: { type: String, required: true },
            name: { type: String, default: '' },
            mime: { type: String, default: '' },
            size: { type: Number, default: 0 },
            uploadedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
            },
          },
          { _id: true, timestamps: { createdAt: true, updatedAt: false } }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
