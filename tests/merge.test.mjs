import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { mergeData } from '../js/merge.js';

const DAY = 86_400_000;
const NOW = 400 * DAY;
const entry = (id, over = {}) => ({ id, date: '2026-11-17', minutes: 30, note: '', createdAt: 10, updatedAt: 10, ...over });
const aCase = (id, key, over = {}) => ({
  id, initials: 'A.S', caseNumber: key, displayId: `A.S-${key}`, createdAt: 10, updatedAt: 10,
  dueDate: null, notes: '', archived: false, archivedAt: null, entries: [], ...over,
});
const data = (cases, tombstones = []) => ({ cases, tombstones });
const merge = (l, i) => mergeData(l, i, NOW);

test('adds cases that only exist in the incoming data', () => {
  const r = merge(data([aCase('a', '1')]), data([aCase('b', '2', { entries: [entry('e1')] })]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.cases.map(c => c.id).sort(), ['a', 'b']);
  assert.deepEqual(r.summary, { casesAdded: 1, casesUpdated: 0, casesRemoved: 0, entriesAdded: 1, entriesUpdated: 0, entriesRemoved: 0 });
});
test('same case id: newer side wins the case fields; older side is ignored; tie keeps local', () => {
  const local = data([aCase('a', '1', { dueDate: '2026-12-01', updatedAt: 20 })]);
  const newer = data([aCase('a', '1', { dueDate: '2026-12-15', updatedAt: 30 })]);
  const older = data([aCase('a', '1', { dueDate: '2026-11-01', updatedAt: 5 })]);
  const tie = data([aCase('a', '1', { dueDate: '2027-01-01', updatedAt: 20 })]);
  assert.equal(merge(local, newer).data.cases[0].dueDate, '2026-12-15');
  assert.equal(merge(local, newer).summary.casesUpdated, 1);
  assert.equal(merge(local, older).data.cases[0].dueDate, '2026-12-01');
  assert.equal(merge(local, tie).data.cases[0].dueDate, '2026-12-01');
});
test('entries are unioned by id; for the same id the newer one wins', () => {
  const local = data([aCase('a', '1', { entries: [entry('e1', { minutes: 30, updatedAt: 20 }), entry('e2')] })]);
  const incoming = data([aCase('a', '1', { entries: [entry('e1', { minutes: 45, updatedAt: 30 }), entry('e3')] })]);
  const r = merge(local, incoming);
  const byId = Object.fromEntries(r.data.cases[0].entries.map(e => [e.id, e.minutes]));
  assert.deepEqual(byId, { e1: 45, e2: 30, e3: 30 });
  assert.equal(r.summary.entriesAdded, 1);
  assert.equal(r.summary.entriesUpdated, 1);
});
test('cases with different ids but the same displayId are the same case; local id is kept', () => {
  const local = data([aCase('local-id', '1', { entries: [entry('e1')] })]);
  const incoming = data([aCase('other-id', '1', { entries: [entry('e2')] })]);
  const r = merge(local, incoming);
  assert.equal(r.data.cases.length, 1);
  assert.equal(r.data.cases[0].id, 'local-id');
  assert.equal(r.data.cases[0].entries.length, 2);
});
test('UUID match beats displayId: a renamed case is updated, not duplicated', () => {
  const local = data([aCase('a', '1', { updatedAt: 10 })]);
  const incoming = data([aCase('a', '77', { updatedAt: 20 })]); // same id, displayId edited on the other device
  const r = merge(local, incoming);
  assert.equal(r.data.cases.length, 1);
  assert.equal(r.data.cases[0].displayId, 'A.S-77');
});
test('an entry tombstone removes an older entry but not one edited after the delete', () => {
  const tomb = [{ type: 'entry', id: 'e1', caseId: 'a', deletedAt: 50 }];
  const old = merge(data([aCase('a', '1', { entries: [entry('e1', { updatedAt: 40 })] })]), data([], tomb));
  assert.equal(old.data.cases[0].entries.length, 0);
  assert.equal(old.summary.entriesRemoved, 1);
  const edited = merge(data([aCase('a', '1', { entries: [entry('e1', { updatedAt: 60 })] })]), data([], tomb));
  assert.equal(edited.data.cases[0].entries.length, 1);
});
test('a case tombstone removes an untouched case, but never entries added after the delete', () => {
  const tomb = [{ type: 'case', id: 'a', deletedAt: 50 }];
  const gone = merge(data([aCase('a', '1', { updatedAt: 10, entries: [entry('e1', { updatedAt: 20 })] })]), data([], tomb));
  assert.equal(gone.data.cases.length, 0);
  assert.equal(gone.summary.casesRemoved, 1);
  const kept = merge(data([aCase('a', '1', { updatedAt: 10, entries: [entry('e1', { updatedAt: 20 }), entry('e2', { updatedAt: 70 })] })]), data([], tomb));
  assert.deepEqual(kept.data.cases[0].entries.map(e => e.id), ['e2']);
  const edited = merge(data([aCase('a', '1', { updatedAt: 60 })]), data([], tomb));
  assert.equal(edited.data.cases.length, 1);
});
test('a deleted case does not come back from a stale copy on the other device', () => {
  const local = data([], [{ type: 'case', id: 'a', deletedAt: 50 }]);
  const stale = data([aCase('a', '1', { updatedAt: 10, entries: [entry('e1', { updatedAt: 20 })] })]);
  const r = merge(local, stale);
  assert.equal(r.data.cases.length, 0);
  assert.equal(r.summary.casesAdded, 0); // net result, not intermediate
});
test('a displayId collision between different cases is rejected and nothing changes', () => {
  const local = data([aCase('a', '1'), aCase('b', '2')]);
  const incoming = data([aCase('a', '2', { updatedAt: 99 })]); // a was renamed to b's ID on the other device
  const before = JSON.parse(JSON.stringify(local));
  const r = merge(local, incoming);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /A\.S-2/);
  assert.deepEqual(local, before);
});
test('two incoming cases resolving to the same local case is rejected', () => {
  const local = data([aCase('x', '1')]);
  const incoming = data([aCase('x', '5'), aCase('y', '1')]); // x matches by id, y matches x by displayId
  assert.equal(merge(local, incoming).ok, false);
});
test('tombstones are unioned and pruned after 365 days', () => {
  const fresh = { type: 'case', id: 'f', deletedAt: NOW - 10 * DAY };
  const stale = { type: 'case', id: 's', deletedAt: NOW - 366 * DAY };
  const r = merge(data([], [fresh]), data([], [stale, { type: 'entry', id: 'e', caseId: 'a', deletedAt: NOW - DAY }]));
  assert.deepEqual(r.data.tombstones.map(t => t.id).sort(), ['e', 'f']);
});
test('the merged tombstone keeps the later deletedAt', () => {
  const r = merge(data([], [{ type: 'case', id: 'a', deletedAt: 10 * DAY + NOW - 20 * DAY }]), data([], [{ type: 'case', id: 'a', deletedAt: NOW - 5 * DAY }]));
  assert.equal(r.data.tombstones.length, 1);
  assert.equal(r.data.tombstones[0].deletedAt, NOW - 5 * DAY);
});
test('an over-limit result is accepted with a warning', () => {
  const many = n => Array.from({ length: n }, (_, i) => aCase(`id${i}`, `${i}`));
  const other = Array.from({ length: 10 }, (_, i) => aCase(`o${i}`, `o${i}`));
  const r = merge(data(many(45)), data(other));
  assert.equal(r.ok, true);
  assert.match(r.warnings[0], /55 active cases/);
});
test('merging does not mutate either input', () => {
  const local = data([aCase('a', '1', { entries: [entry('e1')] })]);
  const incoming = data([aCase('a', '1', { updatedAt: 99, entries: [entry('e1', { updatedAt: 99, minutes: 5 }), entry('e2')] })]);
  const l = JSON.stringify(local), i = JSON.stringify(incoming);
  merge(local, incoming);
  assert.equal(JSON.stringify(local), l);
  assert.equal(JSON.stringify(incoming), i);
});
