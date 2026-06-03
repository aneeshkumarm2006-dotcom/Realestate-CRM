/**
 * automationEventDispatcher.test.js — unit tests for the F4 triggerConfig
 * matchers (AC#1 STATUS_BECAME, plus COLUMN_VALUE_CHANGED / PERSON_ASSIGNED /
 * dormant matchers). Pure matching logic — no DB needed.
 *
 * Run from the server directory:
 *     node --test src/services/automationEventDispatcher.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Models must be registered before requiring the dispatcher (it pulls in the
// controller, which requires the Mongoose models).
require('../models');

const { TRIGGER_MATCHERS } = require('./automationEventDispatcher');

const oid = () => new mongoose.Types.ObjectId();

// ---------------------------------------------------------------------------
// COLUMN_VALUE_CHANGED
// ---------------------------------------------------------------------------
test('COLUMN_VALUE_CHANGED: empty config matches any column', () => {
  const m = TRIGGER_MATCHERS.COLUMN_VALUE_CHANGED;
  assert.equal(m({}, { columnId: oid() }), true);
  assert.equal(m({ columnId: '' }, { columnId: oid() }), true);
});

test('COLUMN_VALUE_CHANGED: configured column must equal the event column', () => {
  const m = TRIGGER_MATCHERS.COLUMN_VALUE_CHANGED;
  const col = oid();
  assert.equal(m({ columnId: col.toString() }, { columnId: col }), true);
  assert.equal(m({ columnId: col.toString() }, { columnId: oid() }), false);
});

// ---------------------------------------------------------------------------
// STATUS_BECAME — AC#1
// ---------------------------------------------------------------------------
test('STATUS_BECAME: AC#1 — matches columnId + toValue (ids)', () => {
  const m = TRIGGER_MATCHERS.STATUS_BECAME;
  const stageCol = oid();
  const cfg = { columnId: stageCol.toString(), toValue: 'viewing_scheduled' };
  // "Qualified" → "Viewing Scheduled"
  assert.equal(
    m(cfg, { columnId: stageCol, fromValue: 'qualified', toValue: 'viewing_scheduled' }),
    true
  );
  // wrong destination value
  assert.equal(
    m(cfg, { columnId: stageCol, fromValue: 'qualified', toValue: 'closed' }),
    false
  );
  // wrong column
  assert.equal(
    m(cfg, { columnId: oid(), toValue: 'viewing_scheduled' }),
    false
  );
});

test('STATUS_BECAME: fromValue, when configured, must also match', () => {
  const m = TRIGGER_MATCHERS.STATUS_BECAME;
  const stageCol = oid();
  const cfg = {
    columnId: stageCol.toString(),
    fromValue: 'qualified',
    toValue: 'viewing_scheduled',
  };
  assert.equal(
    m(cfg, { columnId: stageCol, fromValue: 'qualified', toValue: 'viewing_scheduled' }),
    true
  );
  assert.equal(
    m(cfg, { columnId: stageCol, fromValue: 'contacted', toValue: 'viewing_scheduled' }),
    false
  );
});

// ---------------------------------------------------------------------------
// PERSON_ASSIGNED
// ---------------------------------------------------------------------------
test('PERSON_ASSIGNED: matches column; userId (if set) must be in addedUserIds', () => {
  const m = TRIGGER_MATCHERS.PERSON_ASSIGNED;
  const personCol = oid();
  const u1 = oid();
  const u2 = oid();
  // no userId → any assignment on the column fires
  assert.equal(m({ columnId: personCol.toString() }, { columnId: personCol, addedUserIds: [u1] }), true);
  // specific user present
  assert.equal(
    m({ columnId: personCol.toString(), userId: u1.toString() }, { columnId: personCol, addedUserIds: [u1, u2] }),
    true
  );
  // specific user absent
  assert.equal(
    m({ columnId: personCol.toString(), userId: u1.toString() }, { columnId: personCol, addedUserIds: [u2] }),
    false
  );
});

// ---------------------------------------------------------------------------
// Dormant matchers (FORM_SUBMITTED / WEBHOOK_RECEIVED)
// ---------------------------------------------------------------------------
test('FORM_SUBMITTED / WEBHOOK_RECEIVED: empty config matches; set id must equal', () => {
  const f = TRIGGER_MATCHERS.FORM_SUBMITTED;
  const w = TRIGGER_MATCHERS.WEBHOOK_RECEIVED;
  assert.equal(f({}, { formId: 'abc' }), true);
  assert.equal(f({ formId: 'abc' }, { formId: 'abc' }), true);
  assert.equal(f({ formId: 'abc' }, { formId: 'xyz' }), false);
  assert.equal(w({}, { endpointId: 'e1' }), true);
  assert.equal(w({ endpointId: 'e1' }, { endpointId: 'e1' }), true);
  assert.equal(w({ endpointId: 'e1' }, { endpointId: 'e2' }), false);
});
