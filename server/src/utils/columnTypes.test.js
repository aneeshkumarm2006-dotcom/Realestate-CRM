/**
 * columnTypes.test.js — unit tests for the column type registry.
 *
 * Run from the server directory:
 *     node --test src/utils/columnTypes.test.js
 *
 * Uses the built-in `node:test` runner so no new dependency is required.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  columnTypes,
  getColumnType,
  validateColumnValue,
  evaluateFormula,
} = require('./columnTypes');

const okValidate = (type, value, settings = {}) =>
  assert.doesNotThrow(() => columnTypes[type].validate(value, settings));

const badValidate = (type, value, settings = {}) =>
  assert.throws(() => columnTypes[type].validate(value, settings));

// ---------------------------------------------------------------------------
// text / long_text
// ---------------------------------------------------------------------------
test('text: accepts string + null, rejects non-string', () => {
  okValidate('text', 'hello');
  okValidate('text', null);
  badValidate('text', 42);
});

test('text: serialize trims whitespace', () => {
  assert.equal(columnTypes.text.serialize('  hi  '), 'hi');
});

test('long_text: rejects oversize content', () => {
  okValidate('long_text', 'hello');
  badValidate('long_text', 'x'.repeat(20001));
});

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------
test('number: accepts numbers + numeric strings, rejects NaN', () => {
  okValidate('number', 42);
  okValidate('number', '42');
  okValidate('number', null);
  badValidate('number', 'abc');
});

test('number: enforces min/max from settings', () => {
  okValidate('number', 5, { min: 0, max: 10 });
  badValidate('number', -1, { min: 0 });
  badValidate('number', 11, { max: 10 });
});

// ---------------------------------------------------------------------------
// date / timeline
// ---------------------------------------------------------------------------
test('date: accepts ISO strings + Date instances', () => {
  okValidate('date', '2026-01-01');
  okValidate('date', new Date());
  okValidate('date', null);
  badValidate('date', 'not-a-date');
});

test('timeline: enforces start <= end', () => {
  okValidate('timeline', { start: '2026-01-01', end: '2026-02-01' });
  badValidate('timeline', { start: '2026-02-01', end: '2026-01-01' });
});

// ---------------------------------------------------------------------------
// person
// ---------------------------------------------------------------------------
test('person: accepts array of ObjectIds, rejects bad ids', () => {
  const a = new mongoose.Types.ObjectId().toString();
  const b = new mongoose.Types.ObjectId().toString();
  okValidate('person', [a, b]);
  okValidate('person', []);
  badValidate('person', ['not-an-id']);
  badValidate('person', 'single-string');
});

test('person: serialize deduplicates ids', () => {
  const a = new mongoose.Types.ObjectId().toString();
  assert.deepEqual(columnTypes.person.serialize([a, a]), [a]);
});

// ---------------------------------------------------------------------------
// status / dropdown
// ---------------------------------------------------------------------------
const statusSettings = {
  options: [
    { id: 'new', label: 'New', color: '#000', order: 0 },
    { id: 'won', label: 'Won', color: '#0f0', order: 1, isDefault: true },
  ],
};

test('status: accepts an option id, rejects unknown id', () => {
  okValidate('status', 'new', statusSettings);
  badValidate('status', 'closed', statusSettings);
});

test('status: defaultValue picks the option flagged as default', () => {
  assert.equal(columnTypes.status.defaultValue(statusSettings), 'won');
});

test('dropdown: rejects unknown option id', () => {
  okValidate('dropdown', 'new', statusSettings);
  badValidate('dropdown', 'mystery', statusSettings);
});

// ---------------------------------------------------------------------------
// tags
// ---------------------------------------------------------------------------
test('tags: accepts option ids, rejects unknown', () => {
  const opts = { options: [{ id: 'a' }, { id: 'b' }] };
  okValidate('tags', ['a', 'b'], opts);
  badValidate('tags', ['c'], opts);
});

// ---------------------------------------------------------------------------
// checkbox / rating
// ---------------------------------------------------------------------------
test('checkbox: only boolean is valid', () => {
  okValidate('checkbox', true);
  okValidate('checkbox', false);
  badValidate('checkbox', 'true');
});

test('rating: enforces integer in [0..max]', () => {
  okValidate('rating', 3);
  okValidate('rating', 0);
  badValidate('rating', 6, { max: 5 });
  badValidate('rating', 2.5);
});

// ---------------------------------------------------------------------------
// link / phone / email
// ---------------------------------------------------------------------------
test('link: accepts object or string', () => {
  okValidate('link', 'https://example.com');
  okValidate('link', { url: 'https://example.com', label: 'site' });
});

test('phone: accepts plausible formats, rejects garbage', () => {
  okValidate('phone', '+1 (555) 123-4567');
  badValidate('phone', 'not-a-number');
});

test('email: validates shape', () => {
  okValidate('email', 'a@b.co');
  badValidate('email', 'a@b');
});

// ---------------------------------------------------------------------------
// location / file
// ---------------------------------------------------------------------------
test('location: validates lat/lng bounds', () => {
  okValidate('location', { lat: 53.5, lng: -113.5, label: 'Edmonton' });
  badValidate('location', { lat: 91 });
  badValidate('location', { lng: -181 });
});

test('file: accepts attachment list, rejects non-array', () => {
  okValidate('file', [{ url: 'u', name: 'n', mime: 'image/png', size: 100 }]);
  badValidate('file', { url: 'u' });
});

// ---------------------------------------------------------------------------
// formula / connect_boards / mirror
// ---------------------------------------------------------------------------
test('formula: validate always throws (read-only)', () => {
  badValidate('formula', 1);
});

test('connect_boards: stub throws NOT_IMPLEMENTED', () => {
  assert.throws(
    () => columnTypes.connect_boards.validate({ links: [] }, {}),
    /not implemented/i
  );
});

test('mirror: stub throws NOT_IMPLEMENTED', () => {
  assert.throws(() => columnTypes.mirror.validate('anything', {}), /not implemented/i);
});

// ---------------------------------------------------------------------------
// evaluateFormula
// ---------------------------------------------------------------------------
test('evaluateFormula: simple sum over column references', () => {
  const expr = 'column.a + column.b';
  assert.equal(evaluateFormula(expr, { a: 2, b: 3 }), 5);
});

test('evaluateFormula: returns null when a referenced column is missing', () => {
  assert.equal(evaluateFormula('column.a * 2', {}), null);
});

test('evaluateFormula: rejects unsupported tokens', () => {
  assert.throws(() => evaluateFormula('process.exit(0)', {}), /unsupported/i);
});

// ---------------------------------------------------------------------------
// validateColumnValue convenience
// ---------------------------------------------------------------------------
test('validateColumnValue: returns { ok: true } on valid input', () => {
  const col = { _id: 'c1', type: 'number', settings: {} };
  const result = validateColumnValue(col, 42);
  assert.equal(result.ok, true);
});

test('validateColumnValue: returns { ok: false, error } on invalid input', () => {
  const col = { _id: 'c1', type: 'number', settings: {} };
  const result = validateColumnValue(col, 'nope');
  assert.equal(result.ok, false);
  assert.match(result.error.message, /number/);
});

test('getColumnType: returns null for unknown type', () => {
  assert.equal(getColumnType('not-a-type'), null);
});
