import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import {
  buildBackup, backupFilename, validateBackup, shouldWarnNotInstalled, backupDue,
} from '../js/backup.js';

const entry = (over = {}) => ({ id: 'e1', date: '2026-11-17', minutes: 90, note: 'x', createdAt: 1, updatedAt: 1, ...over });
const aCase = (over = {}) => ({
  id: 'c1', initials: 'A.S', caseNumber: '122', displayId: 'A.S-122', createdAt: 1, updatedAt: 1,
  dueDate: null, notes: '', archived: false, archivedAt: null, entries: [entry()], ...over,
});
const text = (over = {}) => JSON.stringify({
  app: 'caseload-tracker', version: 1, exportedAt: '2026-11-20T00:00:00.000Z',
  cases: [aCase()], tombstones: [], ...over,
});

test('buildBackup wraps data with app, version and exportedAt', () => {
  const b = buildBackup({ cases: [aCase()], tombstones: [] }, Date.UTC(2026, 10, 20));
  assert.equal(b.app, 'caseload-tracker');
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, '2026-11-20T00:00:00.000Z');
  assert.equal(b.cases.length, 1);
  assert.deepEqual(b.tombstones, []);
});
test('backupFilename is dated', () => {
  assert.equal(backupFilename('2026-11-20'), 'caseload-backup-2026-11-20.json');
});
test('a backup round-trips through validateBackup with a summary', () => {
  const b = buildBackup({ cases: [aCase(), aCase({ id: 'c2', displayId: 'B.B-9', initials: 'B.B', caseNumber: '9', archived: true, entries: [entry({ id: 'e2' }), entry({ id: 'e3' })] })], tombstones: [] }, 0);
  const r = validateBackup(JSON.stringify(b));
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.summary, { cases: 2, entries: 3, activeCases: 1 });
  assert.deepEqual(r.warnings, []);
});
test('validateBackup rejects non-JSON, wrong app, wrong version, missing cases', () => {
  assert.equal(validateBackup('not json').ok, false);
  assert.equal(validateBackup('[]').ok, false);
  assert.equal(validateBackup(text({ app: 'other' })).ok, false);
  assert.equal(validateBackup(text({ version: 99 })).ok, false);
  assert.equal(validateBackup(text({ cases: 'nope' })).ok, false);
});
test('validateBackup rejects bad fields with a readable message', () => {
  const bad = (over) => validateBackup(text({ cases: [aCase(over)] }));
  assert.equal(bad({ id: '' }).ok, false);
  assert.equal(bad({ caseNumber: 'a-b', displayId: 'A.S-a-b' }).ok, false);
  assert.equal(bad({ displayId: 'A.S-999' }).ok, false);          // displayId does not match initials+number
  assert.equal(bad({ dueDate: '2026-02-30' }).ok, false);
  assert.equal(bad({ archived: 'no' }).ok, false);
  assert.equal(bad({ entries: [entry({ minutes: 0 })] }).ok, false);
  assert.equal(bad({ entries: [entry({ minutes: 1441 })] }).ok, false);
  assert.equal(bad({ entries: [entry({ minutes: 1.5 })] }).ok, false);
  assert.equal(bad({ entries: [entry({ date: 'nope' })] }).ok, false);
  assert.match(bad({ entries: [entry({ date: 'nope' })] }).errors[0], /Case 1.*entry 1/i);
});
test('validateBackup rejects duplicate ids and duplicate displayIds (case-insensitive)', () => {
  const dupId = validateBackup(text({ cases: [aCase(), aCase({ displayId: 'A.S-123', caseNumber: '123' })] }));
  assert.equal(dupId.ok, false);
  const dupDisplay = validateBackup(text({ cases: [aCase(), aCase({ id: 'c2', entries: [entry({ id: 'e9' })] })] }));
  assert.equal(dupDisplay.ok, false);
  const dupEntry = validateBackup(text({ cases: [aCase(), aCase({ id: 'c2', initials: 'B.B', caseNumber: '9', displayId: 'B.B-9' })] }));
  assert.equal(dupEntry.ok, false); // both use entry id e1
});
test('validateBackup fills optional fields and keeps leading zeros', () => {
  const minimal = { id: 'c1', initials: 'A.S', caseNumber: '00122', displayId: 'A.S-00122', createdAt: 5, archived: false, entries: [{ id: 'e1', date: '2026-11-17', minutes: 5, createdAt: 6 }] };
  const r = validateBackup(JSON.stringify({ app: 'caseload-tracker', version: 1, cases: [minimal] }));
  assert.equal(r.ok, true, r.errors.join('; '));
  const c = r.data.cases[0];
  assert.equal(c.caseNumber, '00122');
  assert.equal(c.updatedAt, 5);
  assert.equal(c.notes, '');
  assert.equal(c.dueDate, null);
  assert.equal(c.entries[0].note, '');
  assert.equal(c.entries[0].updatedAt, 6);
  assert.deepEqual(r.data.tombstones, []);
});
test('validateBackup checks tombstones', () => {
  assert.equal(validateBackup(text({ tombstones: [{ type: 'case', id: 'x', deletedAt: 5 }] })).ok, true);
  assert.equal(validateBackup(text({ tombstones: [{ type: 'weird', id: 'x', deletedAt: 5 }] })).ok, false);
  assert.equal(validateBackup(text({ tombstones: [{ type: 'case', id: '', deletedAt: 5 }] })).ok, false);
});
test('validateBackup accepts more than 50 active cases but warns', () => {
  const many = Array.from({ length: 51 }, (_, i) => aCase({ id: `c${i}`, caseNumber: String(i), displayId: `A.S-${i}`, entries: [] }));
  const r = validateBackup(text({ cases: many }));
  assert.equal(r.ok, true);
  assert.equal(r.summary.activeCases, 51);
  assert.match(r.warnings[0], /51 active cases/);
});
test('validateBackup caps the number of error messages', () => {
  const bad = Array.from({ length: 40 }, (_, i) => aCase({ id: '', displayId: `A.S-${i}`, caseNumber: String(i), entries: [] }));
  assert.ok(validateBackup(text({ cases: bad })).errors.length <= 11);
});
test('shouldWarnNotInstalled only for iOS, in a browser tab, with data', () => {
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: false, caseCount: 3 }), true);
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: true, caseCount: 3 }), false);
  assert.equal(shouldWarnNotInstalled({ isIOS: false, isStandalone: false, caseCount: 3 }), false);
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: false, caseCount: 0 }), false);
});
test('backupDue: after 14 days since last backup, or since the oldest case if never backed up', () => {
  const DAY = 86_400_000;
  const now = 100 * DAY;
  assert.equal(backupDue({ lastBackupMs: now - 13 * DAY, cases: [aCase()], nowMs: now }), false);
  assert.equal(backupDue({ lastBackupMs: now - 14 * DAY, cases: [aCase()], nowMs: now }), true);
  assert.equal(backupDue({ lastBackupMs: null, cases: [aCase({ createdAt: now - DAY })], nowMs: now }), false);
  assert.equal(backupDue({ lastBackupMs: null, cases: [aCase({ createdAt: now - 20 * DAY })], nowMs: now }), true);
  assert.equal(backupDue({ lastBackupMs: null, cases: [], nowMs: now }), false);
});
