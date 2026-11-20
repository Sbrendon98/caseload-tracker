import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import {
  todayLocal, parseISO, addDays, dayOfWeek, daysBetween, weekRange, monthRange,
  schoolYearRange, rangeFor, inRange, monthGrid,
} from '../js/dates.js';

test('todayLocal uses local calendar date, not UTC', () => {
  assert.equal(todayLocal(new Date(2026, 10, 20, 23, 59)), '2026-11-20');
});
test('parseISO rejects impossible dates', () => {
  assert.throws(() => parseISO('2026-02-30'), RangeError);
  assert.throws(() => parseISO('2026-2-3'), RangeError);
});
test('addDays crosses month and year', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});
test('dayOfWeek: 2026-11-15 is Sunday', () => {
  assert.equal(dayOfWeek('2026-11-15'), 0);
  assert.equal(dayOfWeek('2026-11-21'), 6);
});
test('daysBetween is signed and spans months, years and DST changes', () => {
  assert.equal(daysBetween('2026-11-20', '2026-11-27'), 7);
  assert.equal(daysBetween('2026-11-27', '2026-11-20'), -7);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2); // US DST start
  assert.equal(daysBetween('2026-11-20', '2026-11-20'), 0);
});
test('weekRange is Sunday..Saturday by default for any day in the week', () => {
  const want = { start: '2026-11-15', end: '2026-11-21' };
  assert.deepEqual(weekRange('2026-11-15'), want); // Sunday
  assert.deepEqual(weekRange('2026-11-20'), want); // Friday
  assert.deepEqual(weekRange('2026-11-21'), want); // Saturday
});
test('weekRange crosses the year boundary', () => {
  assert.deepEqual(weekRange('2027-01-01'), { start: '2026-12-27', end: '2027-01-02' });
});
test('weekRange with Monday start: Monday..Sunday', () => {
  assert.deepEqual(weekRange('2026-11-20', 1), { start: '2026-11-16', end: '2026-11-22' });
  assert.deepEqual(weekRange('2026-11-16', 1), { start: '2026-11-16', end: '2026-11-22' });
  assert.deepEqual(weekRange('2026-11-15', 1), { start: '2026-11-09', end: '2026-11-15' }); // Sunday belongs to the previous week
});
test('weekRange rejects a bad weekStart', () => {
  assert.throws(() => weekRange('2026-11-20', 7), RangeError);
  assert.throws(() => weekRange('2026-11-20', 'mon'), RangeError);
});
test('monthRange handles leap February and 30-day months', () => {
  assert.deepEqual(monthRange('2028-02-10'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(monthRange('2026-11-20'), { start: '2026-11-01', end: '2026-11-30' });
});
test('schoolYearRange is Jul 1..Jun 30 containing the date', () => {
  assert.deepEqual(schoolYearRange('2026-11-20'), { start: '2026-07-01', end: '2027-06-30' });
  assert.deepEqual(schoolYearRange('2026-06-30'), { start: '2025-07-01', end: '2026-06-30' });
  assert.deepEqual(schoolYearRange('2026-07-01'), { start: '2026-07-01', end: '2027-06-30' });
});
test('rangeFor maps kinds; all is null; week honours weekStart', () => {
  assert.equal(rangeFor('all', '2026-11-20'), null);
  assert.deepEqual(rangeFor('week', '2026-11-20'), weekRange('2026-11-20'));
  assert.deepEqual(rangeFor('week', '2026-11-20', 1), weekRange('2026-11-20', 1));
  assert.deepEqual(rangeFor('month', '2026-11-20'), monthRange('2026-11-20'));
  assert.deepEqual(rangeFor('schoolyear', '2026-11-20'), schoolYearRange('2026-11-20'));
  assert.throws(() => rangeFor('bogus', '2026-11-20'));
});
test('inRange is inclusive and null means everything', () => {
  const r = { start: '2026-11-15', end: '2026-11-21' };
  assert.equal(inRange('2026-11-15', r), true);
  assert.equal(inRange('2026-11-21', r), true);
  assert.equal(inRange('2026-11-14', r), false);
  assert.equal(inRange('2026-11-22', r), false);
  assert.equal(inRange('1999-01-01', null), true);
});
test('monthGrid Nov 2026 (starts on Sunday) has 5 rows', () => {
  const g = monthGrid(2026, 11);
  assert.equal(g.length, 5);
  assert.deepEqual(g[0][0], { date: '2026-11-01', inMonth: true });
  assert.deepEqual(g[4][0], { date: '2026-11-29', inMonth: true });
  assert.deepEqual(g[4][2], { date: '2026-12-01', inMonth: false });
});
test('monthGrid Oct 2026 pads with Sep days', () => {
  const g = monthGrid(2026, 10);
  assert.equal(g.length, 5);
  assert.deepEqual(g[0][0], { date: '2026-09-27', inMonth: false });
  assert.deepEqual(g[0][4], { date: '2026-10-01', inMonth: true });
  assert.deepEqual(g[4][6], { date: '2026-10-31', inMonth: true });
});
test('monthGrid Feb 2026 (28 days, starts Sunday) has exactly 4 rows', () => {
  assert.equal(monthGrid(2026, 2).length, 4);
});
test('monthGrid with Monday start: Nov 2026 needs 6 rows and begins Oct 26', () => {
  const g = monthGrid(2026, 11, 1);
  assert.equal(g.length, 6);
  assert.deepEqual(g[0][0], { date: '2026-10-26', inMonth: false });
  assert.deepEqual(g[0][6], { date: '2026-11-01', inMonth: true });
  assert.deepEqual(g[5][0], { date: '2026-11-30', inMonth: true });
});
