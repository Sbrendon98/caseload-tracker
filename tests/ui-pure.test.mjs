import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { parseHash, routes } from '../js/router.js';
import { formatDateLong, formatClock, formatMonth } from '../js/format.js';
import { matchesSearch } from '../js/model.js';
import { directionLock, clampOffset, settle } from '../js/swipe.js';

// ---- router ----
test('parseHash: list, archived, options, calendar with query, case detail', () => {
  assert.deepEqual(parseHash(''), { name: 'list', params: {}, query: {} });
  assert.deepEqual(parseHash('#/'), { name: 'list', params: {}, query: {} });
  assert.equal(parseHash('#/archived').name, 'archived');
  assert.equal(parseHash('#/options').name, 'options');
  assert.deepEqual(parseHash('#/calendar?case=abc&date=2026-11-20'), { name: 'calendar', params: {}, query: { case: 'abc', date: '2026-11-20' } });
  assert.deepEqual(parseHash('#/case/abc-123'), { name: 'case', params: { id: 'abc-123' }, query: {} });
});
test('parseHash falls back to the list for unknown or malformed routes', () => {
  assert.equal(parseHash('#/nope').name, 'list');
  assert.equal(parseHash('#/case').name, 'list');
  assert.equal(parseHash('#/case/%E0%A4%A').name, 'list'); // bad percent-encoding must not throw
});
test('route builders round-trip through parseHash', () => {
  assert.equal(parseHash(routes.caseDetail('a b/c')).params.id, 'a b/c');
  assert.equal(routes.list(), '#/');
  const cal = parseHash(routes.calendar({ caseId: 'x', date: '2026-11-20' }));
  assert.deepEqual(cal.query, { case: 'x', date: '2026-11-20' });
  assert.equal(routes.calendar(), '#/calendar');
});

// ---- format ----
test('formatDateLong shows weekday and full date in local calendar terms', () => {
  assert.equal(formatDateLong('2026-11-20', 'en-US'), 'Fri, Nov 20, 2026');
  assert.equal(formatDateLong('2027-01-01', 'en-US'), 'Fri, Jan 1, 2027');
});
test('formatClock: m:ss, then h:mm:ss, never negative', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65_000), '1:05');
  assert.equal(formatClock(3_725_000), '1:02:05');
  assert.equal(formatClock(-5), '0:00');
});

// ---- search ----
test('matchesSearch ignores case, dots and dashes, and matches anywhere', () => {
  assert.equal(matchesSearch('A.S-122445543', 'as'), true);
  assert.equal(matchesSearch('A.S-122445543', 'a.s-1224'), true);
  assert.equal(matchesSearch('A.S-122445543', '445'), true);
  assert.equal(matchesSearch('A.S-122445543', 'xyz'), false);
  assert.equal(matchesSearch('A.S-122445543', ''), true);
  assert.equal(matchesSearch('A.S-122445543', '  '), true);
});

// ---- swipe maths ----
test('directionLock waits for movement, then picks the dominant axis', () => {
  assert.equal(directionLock(3, 2), null);
  assert.equal(directionLock(-20, 4), 'x');
  assert.equal(directionLock(5, 30), 'y');
  assert.equal(directionLock(-10, 10), 'y'); // ties favour scrolling
});
test('clampOffset keeps the row between fully closed and fully open', () => {
  assert.equal(clampOffset(40, 96), 0);
  assert.equal(clampOffset(-50, 96), -50);
  assert.equal(clampOffset(-400, 96), -96);
});
test('settle: fast flick wins, otherwise past halfway opens', () => {
  assert.equal(settle({ offset: -10, velocityX: -0.8, openWidth: 96 }), 'open');
  assert.equal(settle({ offset: -90, velocityX: 0.8, openWidth: 96 }), 'closed');
  assert.equal(settle({ offset: -60, velocityX: 0, openWidth: 96 }), 'open');
  assert.equal(settle({ offset: -30, velocityX: 0, openWidth: 96 }), 'closed');
});

test('formatMonth gives the month and year', () => {
  assert.equal(formatMonth(2026, 11, 'en-US'), 'November 2026');
  assert.equal(formatMonth(2027, 1, 'en-US'), 'January 2027');
});
