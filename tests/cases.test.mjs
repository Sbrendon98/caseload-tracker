import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import {
  normalizeCaseNumber, makeDisplayId, findDuplicate, validateCase, activeCount, canAddActive, dueStatus,
} from '../js/cases.js';

const mk = (id, displayId, archived = false) => ({ id, displayId, archived });

test('case number stays a trimmed string, leading zeros kept', () => {
  assert.equal(normalizeCaseNumber('  00123 '), '00123');
  assert.equal(typeof normalizeCaseNumber(123), 'string');
});
test('makeDisplayId', () => {
  assert.equal(makeDisplayId('A.S', '122445543'), 'A.S-122445543');
});
test('findDuplicate is case-insensitive and covers archived', () => {
  const cases = [mk('1', 'A.S-AB1', true)];
  assert.equal(findDuplicate(cases, 'a.s-ab1').id, '1');
  assert.equal(findDuplicate(cases, 'A.S-AB2'), null);
  assert.equal(findDuplicate(cases, 'A.S-AB1', '1'), null); // editing itself
});
test('validateCase accepts good input and builds displayId', () => {
  const r = validateCase({ initials: 'as', caseNumber: ' 00122 ', dueDate: '' }, []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { initials: 'A.S', caseNumber: '00122', displayId: 'A.S-00122', dueDate: null, notes: '' });
});
test('validateCase trims notes and keeps their line breaks', () => {
  const r = validateCase({ initials: 'as', caseNumber: '1', notes: '  waiting on consent\nparent unreachable  ' }, []);
  assert.equal(r.value.notes, 'waiting on consent\nparent unreachable');
});
test('validateCase rejects empty initials, bad case number, bad due date', () => {
  const r = validateCase({ initials: '12', caseNumber: 'ab-1', dueDate: '2026-02-30' }, []);
  assert.equal(r.ok, false);
  assert.ok(r.errors.initials && r.errors.caseNumber && r.errors.dueDate);
});
test('validateCase blocks duplicates with a clear message, mentioning archive', () => {
  const cases = [mk('1', 'A.S-122', true)];
  const r = validateCase({ initials: 'a s', caseNumber: '122' }, cases);
  assert.equal(r.ok, false);
  assert.match(r.errors.duplicate, /A\.S-122 already exists in your archive/);
});
test('validateCase allows editing a case without tripping on itself', () => {
  const cases = [mk('1', 'A.S-122')];
  assert.equal(validateCase({ initials: 'as', caseNumber: '122' }, cases, { exceptId: '1' }).ok, true);
});
test('canAddActive: 49 ok, 50 blocked, archived do not count', () => {
  const active = n => Array.from({ length: n }, (_, i) => mk(`a${i}`, `X-${i}`));
  const archived = Array.from({ length: 30 }, (_, i) => mk(`z${i}`, `Z-${i}`, true));
  assert.equal(canAddActive([...active(49), ...archived]), true);
  assert.equal(canAddActive([...active(50), ...archived]), false);
  assert.equal(canAddActive(active(51)), false); // over-limit restore state
  assert.equal(activeCount([...active(3), ...archived]), 3);
});
test('dueStatus: none, overdue, due today counts as soon, soon window, later', () => {
  const today = '2026-11-20';
  assert.equal(dueStatus(null, today), null);
  assert.equal(dueStatus('', today), null);
  assert.equal(dueStatus('2026-11-19', today), 'overdue');
  assert.equal(dueStatus('2026-11-20', today), 'soon');
  assert.equal(dueStatus('2026-11-27', today), 'soon');
  assert.equal(dueStatus('2026-11-28', today), null);
  assert.equal(dueStatus('2026-11-28', today, 10), 'soon');
});
test('validateCase accepts a first name plus last initial, and builds the case ID from it', () => {
  const r = validateCase({ initials: 'jane d', caseNumber: '5551' }, []);
  assert.equal(r.ok, true);
  assert.equal(r.value.initials, 'Jane D.');
  assert.equal(r.value.displayId, 'Jane D.-5551');
});
test('validateCase rejects a full name with the reason, and builds no ID from it', () => {
  const r = validateCase({ initials: 'Jane Doe', caseNumber: '1' }, []);
  assert.equal(r.ok, false);
  assert.match(r.errors.initials, /first name and last initial/i);
  assert.equal(r.value.displayId, null);
});
test('validateCase: case number is up to 10 letters or digits', () => {
  assert.equal(validateCase({ initials: 'A S', caseNumber: '1234567890' }, []).ok, true);
  const long = validateCase({ initials: 'A S', caseNumber: '12345678901' }, []);
  assert.equal(long.ok, false);
  assert.match(long.errors.caseNumber, /up to 10/i);
  assert.equal(validateCase({ initials: 'A S', caseNumber: 'AB-12' }, []).ok, false);
  assert.equal(validateCase({ initials: 'A S', caseNumber: '' }, []).ok, false);
});
test('the same name rules apply when editing a case', () => {
  const cases = [{ id: '1', displayId: 'A.S-1', archived: false }];
  assert.equal(validateCase({ initials: 'Jane Doe', caseNumber: '1' }, cases, { exceptId: '1' }).ok, false);
  assert.equal(validateCase({ initials: 'Jane D.', caseNumber: '1' }, cases, { exceptId: '1' }).ok, true);
});
