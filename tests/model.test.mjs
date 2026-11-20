import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import {
  parseName, normalizeCaseNumber, makeDisplayId, findDuplicate, validateCase,
  validateEntry, totalMinutes, formatDuration, decimalHours, activeCount, canAddActive,
  dueStatus, elapsedMinutes, durationInWords, durationShort,
} from '../js/model.js';

const mk = (id, displayId, archived = false) => ({ id, displayId, archived });

test('parseName: initials in any format become dotted capitals', () => {
  const ok = (raw, want) => assert.deepEqual(parseName(raw), { ok: true, value: want, error: null }, raw);
  ok('as', 'A.S');
  ok('A S', 'A.S');
  ok('a.s.', 'A.S');
  ok(' A. B. C ', 'A.B.C');
  ok('A B C D', 'A.B.C.D');
  ok('J.D', 'J.D');
  ok('é', 'É');
});
test('parseName: first name plus last initial, tidily capitalized', () => {
  const ok = (raw, want) => assert.deepEqual(parseName(raw), { ok: true, value: want, error: null }, raw);
  ok('Jane D.', 'Jane D.');
  ok('jane d', 'Jane D.');
  ok('JANE D', 'Jane D.');
  ok('Jane   d.', 'Jane D.');
  ok('mary-jane d', 'Mary-Jane D.');
  ok("o'neil d", "O'Neil D.");
  ok('Al D', 'Al D.');
});
test('parseName: short all-caps words are initials, not names', () => {
  assert.equal(parseName('AL D').value, 'A.L.D');
  assert.equal(parseName('AB C').value, 'A.B.C');
  assert.equal(parseName('JD').value, 'J.D');
});
test('parseName is stable: its own output parses to itself', () => {
  for (const v of ['A.S', 'A.B.C.D', 'Jane D.', 'Mary-Jane D.', "O'Neil D.", 'Al D.']) assert.equal(parseName(v).value, v, v);
});
test('parseName rejects a full last name, a lone first name, too many initials, and no letters', () => {
  for (const bad of ['Jane Doe', 'Jane Marie D', 'Jane', 'Anna', 'JaneDoe', 'JANE DOE', 'A B C D E', '123 -', '', null]) {
    const r = parseName(bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.value, '');
    assert.match(r.error, /first name and last initial/i);
  }
});
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
test('validateEntry converts hours+minutes to total minutes', () => {
  const r = validateEntry({ date: '2026-11-20', hours: '1', minutes: '15', note: '  hi ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { date: '2026-11-20', minutes: 75, note: 'hi' });
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
test('totalMinutes, formatDuration, decimalHours', () => {
  assert.equal(totalMinutes([{ minutes: 30 }, { minutes: 45 }]), 75);
  assert.equal(totalMinutes([]), 0);
  assert.equal(formatDuration(75), '1h 15m');
  assert.equal(formatDuration(5), '0h 5m');
  assert.equal(formatDuration(0), '0h 0m');
  assert.equal(decimalHours(90), '1.50');
  assert.equal(decimalHours(20), '0.33');
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
test('elapsedMinutes rounds up and is at least 1', () => {
  assert.equal(elapsedMinutes(0, 1_000), 1);          // 1 second
  assert.equal(elapsedMinutes(0, 60_000), 1);         // exactly 1 minute
  assert.equal(elapsedMinutes(0, 60_001), 2);
  assert.equal(elapsedMinutes(0, 25 * 60_000 + 1), 26);
  assert.equal(elapsedMinutes(5_000, 1_000), 1);      // clock went backwards: never 0 or negative
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
