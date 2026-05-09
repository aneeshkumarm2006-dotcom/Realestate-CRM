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
    schedule: {
      type: scheduleSchema,
      required: true,
    },
    taskTemplate: {
      type: taskTemplateSchema,
      required: true,
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
