const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    daysOfWeek: [
      {
        type: Number,
        min: 0,
        max: 6,
      },
    ],
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    useLastDayOfMonth: {
      type: Boolean,
      default: false,
    },
    hour: {
      type: Number,
      min: 0,
      max: 23,
      default: 9,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  { _id: false }
);

const taskTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskGroup',
      required: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    note: {
      type: String,
    },
    dueInDays: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

/**
 * Condition row evaluated against the triggering task for ITEM_CREATED
 * automations. `value` is an ObjectId pointing into a board sub-document:
 *   - ITEM_IN_GROUP   → matches against task.group     (TaskGroup._id)
 *   - ITEM_IN_STATUS  → matches against task.status    (Board.statuses._id)
 */
const conditionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['ITEM_IN_GROUP', 'ITEM_IN_STATUS'],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Per-action config. Both action types share the same shape — `group` is
 * required for CREATE_TASK (where the new top-level task needs a home) but
 * ignored for CREATE_SUBITEM (which inherits the parent's group).
 */
const actionConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskGroup',
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: mongoose.Schema.Types.ObjectId,
    },
    note: { type: String },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['CREATE_TASK', 'CREATE_SUBITEM'],
      required: true,
    },
    config: { type: actionConfigSchema, required: true },
  },
  { _id: false }
);

const automationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // What fires this automation. SCHEDULE is the legacy cron-style trigger;
    // ITEM_CREATED runs in response to a task being created on the board.
    triggerType: {
      type: String,
      enum: ['SCHEDULE', 'ITEM_CREATED'],
      default: 'SCHEDULE',
      index: true,
    },
    // Legacy schedule/template: required only for SCHEDULE triggers, kept
    // optional in the schema so ITEM_CREATED automations can save without
    // them.
    schedule: {
      type: scheduleSchema,
    },
    taskTemplate: {
      type: taskTemplateSchema,
    },
    // New event-driven shape: only used when actions[] is non-empty. If set,
    // runAutomationOnce runs every action in order and ignores taskTemplate.
    conditions: {
      type: [conditionSchema],
      default: [],
    },
    actions: {
      type: [actionSchema],
      default: [],
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    nextRunAt: {
      type: Date,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Automation', automationSchema);
