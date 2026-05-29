const mongoose = require('mongoose');

/**
 * Per-board label. Tasks reference labels by `_id` so renames/recolors
 * don't break the link. `order` is an integer used for client-side sorting
 * (smaller = earlier).
 */
const labelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#6B7280' },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

/**
 * Per-board status. `key` is an optional stable handle preserved from the
 * legacy 4-status enum (`not_started`, `working_on_it`, `done`, `stuck`).
 * Analytics and automation code keys off `key` to resolve the "done"
 * status across boards even after the user renames it. New statuses
 * created by the user have `key: null`.
 *
 * `isDefault` flags the status that newly-created tasks fall back to when
 * no explicit status is supplied. Exactly one status per board should
 * carry `isDefault: true`; deletion of that status is blocked.
 */
const statusSchema = new mongoose.Schema(
  {
    key: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#6B7280' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false }
);

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
    },
    order: { type: Number, default: 0, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    labels: { type: [labelSchema], default: [] },
    statuses: { type: [statusSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Board', boardSchema);
