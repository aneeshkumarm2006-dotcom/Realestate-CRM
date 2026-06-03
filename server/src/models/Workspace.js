/**
 * Workspace — readability alias for the Organisation model (Phase 1 / F3).
 *
 * The MongoDB collection stays named `organisations` to avoid downtime; only
 * the API + UI surface renames to "Workspace". New code may
 * `require('../models/Workspace')` to read more naturally — it is the SAME
 * Mongoose model instance, so `instanceof` checks and `.populate('...')` refs
 * (`ref: 'Organisation'`) resolve identically.
 */
module.exports = require('./Organisation');
