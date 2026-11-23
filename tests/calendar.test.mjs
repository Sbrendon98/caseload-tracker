import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { entriesByDay, casesForDay, shiftMonth } from '../js/calendar.js';

const e = (date, minutes) => ({ id: `${date}-${minutes}`, date, minutes });
const cases = [
  { id: 'a', displayId: 'B.B-2', archived: false, entries: [e('2026-11-16', 30), e('2026-11-16', 15), e('2026-11-17', 60)] },
  { id: 'b', displayId: 'A.A-1', archived: true, entries: [e('2026-11-16', 45)] },
  { id: 'c', displayId: 'C.C-3', archived: false, entries: [] },
];

test('entriesByDay sums seconds per date across cases, archived included', () => {
  const m = entriesByDay(cases);
  assert.equal(m.get('2026-11-16'), 90 * 60);
  assert.equal(m.get('2026-11-17'), 60 * 60);
  assert.equal(m.has('2026-11-18'), false);
});
test('entriesByDay filters to one case', () => {
  const m = entriesByDay(cases, { caseId: 'a' });
  assert.equal(m.get('2026-11-16'), 45 * 60);
  assert.equal(m.size, 2);
});
test('casesForDay lists each case once with its seconds, sorted by displayId, plus total', () => {
  const r = casesForDay(cases, '2026-11-16');
  assert.equal(r.total, 90 * 60);
  assert.deepEqual(r.items, [
    { caseId: 'b', displayId: 'A.A-1', seconds: 45 * 60, archived: true },
    { caseId: 'a', displayId: 'B.B-2', seconds: 45 * 60, archived: false },
  ]);
});
test('casesForDay on an empty day, and with a case filter', () => {
  assert.deepEqual(casesForDay(cases, '2026-11-20'), { total: 0, items: [] });
  assert.equal(casesForDay(cases, '2026-11-16', { caseId: 'a' }).items.length, 1);
  assert.equal(casesForDay(cases, '2026-11-17', { caseId: 'b' }).total, 0);
});
test('shiftMonth moves by months and rolls the year both ways', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2026, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 6 }, -18), { year: 2024, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 6 }, 0), { year: 2026, month: 6 });
});

test('a timer entry under one minute still shows on the calendar (dot and day list)', () => {
  const quick = [{ id: 'q', displayId: 'Q.Q-1', archived: false, entries: [{ id: 'x', date: '2026-11-22', minutes: 0, seconds: 4 }] }];
  assert.equal(entriesByDay(quick).get('2026-11-22'), 4);
  assert.deepEqual(casesForDay(quick, '2026-11-22'), {
    total: 4, items: [{ caseId: 'q', displayId: 'Q.Q-1', seconds: 4, archived: false }],
  });
});
test('seconds and minutes combine, and entries from before seconds existed still count', () => {
  const mixed = [{ id: 'm', displayId: 'M-1', archived: false, entries: [
    { id: '1', date: '2026-11-22', minutes: 1, seconds: 31 }, { id: '2', date: '2026-11-22', minutes: 2 } ] }];
  assert.equal(entriesByDay(mixed).get('2026-11-22'), 211);
});
