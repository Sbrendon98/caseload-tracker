import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { validateEntry } from '../js/entries.js';

test('validateEntry converts hours+minutes to total minutes', () => {
  const r = validateEntry({ date: '2026-11-20', hours: '1', minutes: '15', note: '  hi ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { date: '2026-11-20', minutes: 75, seconds: 0, note: 'hi' });
});
test('validateEntry treats blank hours or minutes as 0', () => {
  assert.equal(validateEntry({ date: '2026-11-20', hours: '', minutes: '30' }).value.minutes, 30);
  assert.equal(validateEntry({ date: '2026-11-20', hours: '2', minutes: '' }).value.minutes, 120);
});
test('validateEntry rejects zero total, minutes >= 60, decimals, negatives, junk', () => {
  const base = { date: '2026-11-20' };
  assert.ok(validateEntry({ ...base, hours: '0', minutes: '0' }).errors.total);
  assert.ok(validateEntry({ ...base, hours: '0', minutes: '60' }).errors.minutes);
  assert.ok(validateEntry({ ...base, hours: '1.5', minutes: '0' }).errors.hours);
  assert.ok(validateEntry({ ...base, hours: '-1', minutes: '30' }).errors.hours);
  assert.ok(validateEntry({ ...base, hours: 'abc', minutes: '0' }).errors.hours);
});
test('validateEntry rejects a single entry over 24 hours and a bad date', () => {
  assert.ok(validateEntry({ date: '2026-11-20', hours: '24', minutes: '1' }).errors.total);
  assert.equal(validateEntry({ date: '2026-11-20', hours: '24', minutes: '0' }).ok, true);
  assert.ok(validateEntry({ date: 'nope', hours: '1', minutes: '0' }).errors.date);
});
test('validateEntry: seconds are optional, 0 to 59, count toward the total, and stay within 24 hours', () => {
  const base = { date: '2026-11-20', hours: '0', minutes: '0' };
  const only = validateEntry({ ...base, seconds: 3 });
  assert.equal(only.ok, true);
  assert.deepEqual(only.value, { date: '2026-11-20', minutes: 0, seconds: 3, note: '' });
  assert.equal(validateEntry({ ...base, minutes: '5' }).value.seconds, 0);
  assert.ok(validateEntry({ ...base, seconds: 60 }).errors.seconds);
  assert.ok(validateEntry({ ...base, seconds: -1 }).errors.seconds);
  assert.ok(validateEntry({ date: '2026-11-20', hours: '24', minutes: '0', seconds: 1 }).errors.total);
});
