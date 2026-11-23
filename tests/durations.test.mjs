import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import {
  decimalHours, durationInWords, durationShort, entrySeconds, formatDurationSeconds, totalSeconds,
} from '../js/durations.js';

test('decimalHours: two decimals', () => {
  assert.equal(decimalHours(90), '1.50');
  assert.equal(decimalHours(20), '0.33');
});
test('durationInWords: plain English, singular and plural', () => {
  assert.equal(durationInWords(73), '1 hour and 13 minutes');
  assert.equal(durationInWords(135), '2 hours and 15 minutes');
  assert.equal(durationInWords(61), '1 hour and 1 minute');
  assert.equal(durationInWords(60), '1 hour');
  assert.equal(durationInWords(120), '2 hours');
  assert.equal(durationInWords(45), '45 minutes');
  assert.equal(durationInWords(1), '1 minute');
  assert.equal(durationInWords(0), '0 minutes');
});
test('durationShort: compact form used inside the date list', () => {
  assert.equal(durationShort(75), '1 hr 15 min');
  assert.equal(durationShort(45), '45 min');
  assert.equal(durationShort(60), '1 hr');
  assert.equal(durationShort(120), '2 hr');
  assert.equal(durationShort(0), '0 min');
});
test('seconds: formatDurationSeconds, entrySeconds, totalSeconds', () => {
  assert.equal(formatDurationSeconds(5430 + 12), '1h 30m 42s');
  assert.equal(formatDurationSeconds(91), '0h 1m 31s');
  assert.equal(formatDurationSeconds(0), '0h 0m 0s');
  assert.equal(entrySeconds({ minutes: 2, seconds: 5 }), 125);
  assert.equal(entrySeconds({ minutes: 2 }), 120); // entries made before seconds existed
  assert.equal(totalSeconds([{ minutes: 1, seconds: 31 }, { minutes: 2 }]), 211);
});
