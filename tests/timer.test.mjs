import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { timerStop, validateTimerStart } from '../js/timer.js';

test('timerStop keeps the exact seconds; over 24 hours is not silently capped', () => {
  const H = 3_600_000;
  assert.deepEqual(timerStop(0, 91_000), { ok: true, minutes: 1, seconds: 31 });
  assert.deepEqual(timerStop(0, 91_900), { ok: true, minutes: 1, seconds: 31 }); // whole seconds, not rounded up
  assert.deepEqual(timerStop(0, 400), { ok: true, minutes: 0, seconds: 1 });      // never saves a zero-length entry
  assert.deepEqual(timerStop(5_000, 1_000), { ok: true, minutes: 0, seconds: 1 }); // clock went backwards
  assert.deepEqual(timerStop(0, 24 * H), { ok: true, minutes: 1440, seconds: 0 });
  const late = timerStop(0, 24 * H + 60_000);
  assert.equal(late.ok, false);
  assert.equal(late.reason, 'too-long');
});
test('validateTimerStart: must be a real time, not in the future, and not absurdly old', () => {
  const now = new Date(2026, 10, 20, 12).getTime();
  assert.equal(validateTimerStart(now - 60_000, now).ok, true);
  assert.equal(validateTimerStart(now, now).ok, true);
  assert.match(validateTimerStart(now + 60_000, now).error, /future/i);
  assert.match(validateTimerStart(NaN, now).error, /valid date and time/i);
});
