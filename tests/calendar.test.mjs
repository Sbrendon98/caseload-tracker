import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { entriesByDay, casesForDay } from '../js/calendar.js';

const e = (date, minutes) => ({ id: `${date}-${minutes}`, date, minutes });
const cases = [
  { id: 'a', displayId: 'B.B-2', archived: false, entries: [e('2026-11-16', 30), e('2026-11-16', 15), e('2026-11-17', 60)] },
  { id: 'b', displayId: 'A.A-1', archived: true, entries: [e('2026-11-16', 45)] },
  { id: 'c', displayId: 'C.C-3', archived: false, entries: [] },
];

test('entriesByDay sums minutes per date across cases, archived included', () => {
  const m = entriesByDay(cases);
  assert.equal(m.get('2026-11-16'), 90);
  assert.equal(m.get('2026-11-17'), 60);
  assert.equal(m.has('2026-11-18'), false);
});
test('entriesByDay filters to one case', () => {
  const m = entriesByDay(cases, { caseId: 'a' });
  assert.equal(m.get('2026-11-16'), 45);
  assert.equal(m.size, 2);
});
test('casesForDay lists each case once with its minutes, sorted by displayId, plus total', () => {
  const r = casesForDay(cases, '2026-11-16');
  assert.equal(r.total, 90);
  assert.deepEqual(r.items, [
    { caseId: 'b', displayId: 'A.A-1', minutes: 45, archived: true },
    { caseId: 'a', displayId: 'B.B-2', minutes: 45, archived: false },
  ]);
});
test('casesForDay on an empty day, and with a case filter', () => {
  assert.deepEqual(casesForDay(cases, '2026-11-20'), { total: 0, items: [] });
  assert.equal(casesForDay(cases, '2026-11-16', { caseId: 'a' }).items.length, 1);
  assert.equal(casesForDay(cases, '2026-11-17', { caseId: 'b' }).total, 0);
});
