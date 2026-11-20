import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { createStore } from '../js/store.js';
import { StorageError } from '../js/db.js';
import { createMemoryDb } from './memory-db.mjs';

function setup() {
  const db = createMemoryDb();
  let clock = 1000;
  let n = 0;
  const store = createStore(db, { now: () => clock, uuid: () => `id${++n}` });
  return { db, store, tick: (ms = 1000) => { clock += ms; return clock; } };
}
const input = (i, over = {}) => ({ initials: 'A', caseNumber: String(i), dueDate: '', notes: '', ...over });
async function fill(store, count) {
  for (let i = 1; i <= count; i++) assert.equal((await store.addCase(input(i))).ok, true);
}
const entryInput = (over = {}) => ({ date: '2026-11-20', hours: '0', minutes: '30', note: '', ...over });

test('addCase stores a normalized case and persists it', async () => {
  const { db, store } = setup();
  const r = await store.addCase({ initials: 'a s', caseNumber: '00122', dueDate: '2026-12-01', notes: ' blocked ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.case, {
    id: 'id1', initials: 'A.S', caseNumber: '00122', displayId: 'A.S-00122', dueDate: '2026-12-01',
    notes: 'blocked', createdAt: 1000, updatedAt: 1000, archived: false, archivedAt: null, entries: [],
  });
  assert.equal(store.cases().length, 1);
  assert.equal((await db.getAll()).cases.length, 1);
});
test('addCase blocks duplicates, case-insensitively, including archived cases', async () => {
  const { store } = setup();
  const a = (await store.addCase(input(1))).case;
  assert.equal((await store.addCase(input(1, { initials: 'a' }))).ok, false);
  await store.archive(a.id);
  const again = await store.addCase(input(1));
  assert.equal(again.ok, false);
  assert.match(again.errors.duplicate, /already exists in your archive/);
});
test('addCase reports validation errors before the limit', async () => {
  const { store } = setup();
  await fill(store, 50);
  const r = await store.addCase({ initials: '1', caseNumber: '' });
  assert.ok(r.errors);
  assert.equal(r.reason, undefined);
});
test('the 51st active case is refused with reason "limit" and nothing is saved', async () => {
  const { db, store } = setup();
  await fill(store, 50);
  const r = await store.addCase(input(51));
  assert.deepEqual(r, { ok: false, reason: 'limit' });
  assert.equal(store.cases().length, 50);
  assert.equal((await db.getAll()).cases.length, 50);
});
test('archived cases do not count toward the limit', async () => {
  const { store } = setup();
  await fill(store, 50);
  await store.archive(store.cases()[0].id);
  assert.equal((await store.addCase(input(51))).ok, true);
});
test('unarchive at 50 active is refused; works once there is room', async () => {
  const { store } = setup();
  await fill(store, 50);
  const first = store.cases()[0];
  await store.archive(first.id);
  await store.addCase(input(51)); // back to 50 active
  assert.deepEqual(await store.unarchive(first.id), { ok: false, reason: 'limit' });
  assert.equal(store.getCase(first.id).archived, true);
  await store.archive(store.cases()[1].id);
  assert.equal((await store.unarchive(first.id)).ok, true);
  assert.equal(store.getCase(first.id).archived, false);
});
test('updateCase recomputes displayId, ignores itself in the duplicate check, and bumps updatedAt', async () => {
  const { store, tick } = setup();
  const a = (await store.addCase(input(1))).case;
  await store.addCase(input(2));
  tick();
  assert.equal((await store.updateCase(a.id, input(1, { dueDate: '2026-12-31' }))).ok, true);
  assert.equal(store.getCase(a.id).dueDate, '2026-12-31');
  assert.equal(store.getCase(a.id).updatedAt, 2000);
  assert.equal((await store.updateCase(a.id, input(2))).ok, false); // collides with case 2
  assert.equal((await store.updateCase(a.id, input(9))).ok, true);
  assert.equal(store.getCase(a.id).displayId, 'A-9');
  assert.deepEqual(await store.updateCase('nope', input(1)), { ok: false, reason: 'notfound' });
});
test('entries: add, edit, delete; totals come from the data; deletes leave a tombstone', async () => {
  const { store, tick } = setup();
  const c = (await store.addCase(input(1))).case;
  const added = await store.addEntry(c.id, entryInput({ hours: '1', minutes: '15', note: ' hi ' }));
  assert.equal(added.ok, true);
  assert.equal(added.entry.minutes, 75);
  assert.equal(added.entry.note, 'hi');
  tick();
  assert.equal((await store.updateEntry(c.id, added.entry.id, entryInput({ minutes: '45' }))).ok, true);
  assert.equal(store.getCase(c.id).entries[0].minutes, 45);
  assert.equal(store.getCase(c.id).entries[0].updatedAt, 2000);
  assert.equal(store.getCase(c.id).entries[0].createdAt, 1000);
  tick();
  assert.equal((await store.deleteEntry(c.id, added.entry.id)).ok, true);
  assert.equal(store.getCase(c.id).entries.length, 0);
  assert.deepEqual(store.tombstones(), [{ type: 'entry', id: added.entry.id, caseId: c.id, deletedAt: 3000 }]);
});
test('addEntry rejects invalid input and unknown cases', async () => {
  const { store } = setup();
  const c = (await store.addCase(input(1))).case;
  assert.ok((await store.addEntry(c.id, entryInput({ minutes: '0' }))).errors.total);
  assert.deepEqual(await store.addEntry('nope', entryInput()), { ok: false, reason: 'notfound' });
  assert.equal(store.getCase(c.id).entries.length, 0);
});
test('deleteCase removes it with its entries and leaves a case tombstone', async () => {
  const { store } = setup();
  const c = (await store.addCase(input(1))).case;
  await store.addEntry(c.id, entryInput());
  assert.equal((await store.deleteCase(c.id)).ok, true);
  assert.equal(store.cases().length, 0);
  assert.deepEqual(store.tombstones().map(t => [t.type, t.id]), [['case', c.id]]);
});
test('a failed write throws StorageError and leaves the snapshot untouched; the store still works after', async () => {
  const { db, store } = setup();
  const c = (await store.addCase(input(1))).case;
  db.failNext('disk full');
  await assert.rejects(store.addEntry(c.id, entryInput()), StorageError);
  assert.equal(store.getCase(c.id).entries.length, 0);
  assert.equal((await store.addEntry(c.id, entryInput())).ok, true);
});
test('writes are serialized: two simultaneous identical addCase calls give one success', async () => {
  const { store } = setup();
  const results = await Promise.all([store.addCase(input(1)), store.addCase(input(1))]);
  assert.deepEqual(results.map(r => r.ok).sort(), [false, true]);
  assert.equal(store.cases().length, 1);
});
test('load() rebuilds the snapshot from the database', async () => {
  const db = createMemoryDb();
  const first = createStore(db, { now: () => 5, uuid: () => 'x1' });
  await first.addCase(input(1));
  await first.setMeta('weekStart', 1);
  const second = createStore(db);
  assert.equal(second.cases().length, 0);
  await second.load();
  assert.equal(second.cases().length, 1);
  assert.equal(second.getMeta('weekStart'), 1);
});
test('sorted views: active newest first, oldest first, archived newest-archived first', async () => {
  const { store, tick } = setup();
  const a = (await store.addCase(input(1))).case; tick();
  const b = (await store.addCase(input(2))).case; tick();
  const c = (await store.addCase(input(3))).case; tick();
  await store.archive(a.id); tick();
  await store.archive(c.id);
  assert.deepEqual(store.activeNewestFirst().map(x => x.id), [b.id]);
  await store.unarchive(a.id);
  assert.deepEqual(store.activeNewestFirst().map(x => x.id), [b.id, a.id]); // b was added after a
  assert.deepEqual(store.activeOldestFirst().map(x => x.id), [a.id, b.id]);
  assert.deepEqual(store.archivedNewestFirst().map(x => x.id), [c.id]);
});
test('replaceAll swaps cases and tombstones; an over-limit restore blocks adds until under 50', async () => {
  const { store } = setup();
  const cases = Array.from({ length: 51 }, (_, i) => ({
    id: `r${i}`, initials: 'B', caseNumber: String(i), displayId: `B-${i}`, createdAt: i, updatedAt: i,
    dueDate: null, notes: '', archived: false, archivedAt: null, entries: [],
  }));
  await store.replaceAll({ cases, tombstones: [{ type: 'case', id: 'gone', deletedAt: 9 }] });
  assert.equal(store.cases().length, 51);
  assert.equal(store.tombstones().length, 1);
  assert.deepEqual(await store.addCase(input(1)), { ok: false, reason: 'limit' });
  await store.archive('r0');
  assert.deepEqual(await store.addCase(input(1)), { ok: false, reason: 'limit' }); // 50 active: still full
  await store.archive('r1');
  assert.equal((await store.addCase(input(1))).ok, true);
});
test('a failed replaceAll keeps the current data', async () => {
  const { db, store } = setup();
  await store.addCase(input(1));
  db.failNext();
  await assert.rejects(store.replaceAll({ cases: [], tombstones: [] }), StorageError);
  assert.equal(store.cases().length, 1);
});
test('applyMerge persists the merged data and returns the summary', async () => {
  const { db, store } = setup();
  await store.addCase(input(1));
  const incoming = { cases: [{ id: 'z', initials: 'Z', caseNumber: '9', displayId: 'Z-9', createdAt: 1, updatedAt: 1, dueDate: null, notes: '', archived: false, archivedAt: null, entries: [] }], tombstones: [] };
  const r = await store.applyMerge(incoming);
  assert.equal(r.ok, true);
  assert.equal(r.summary.casesAdded, 1);
  assert.equal(store.cases().length, 2);
  assert.equal((await db.getAll()).cases.length, 2);
});
test('a rejected merge changes nothing', async () => {
  const { store } = setup();
  const a = (await store.addCase(input(1))).case;
  await store.addCase(input(2));
  const clash = { ...a, displayId: 'A-2', caseNumber: '2', updatedAt: 99999 }; // same id as a, renamed onto case 2
  const r = await store.applyMerge({ cases: [clash], tombstones: [] });
  assert.equal(r.ok, false);
  assert.equal(store.getCase(a.id).displayId, 'A-1');
});
test('subscribers hear about each change; unsubscribe stops them', async () => {
  const { store } = setup();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  await store.addCase(input(1));
  assert.equal(calls, 1);
  await store.addCase(input(1)); // rejected: no change, no notification
  assert.equal(calls, 1);
  off();
  await store.addCase(input(2));
  assert.equal(calls, 1);
});
test('meta: set, get with fallback, delete with undefined', async () => {
  const { store } = setup();
  assert.equal(store.getMeta('x', 'fallback'), 'fallback');
  await store.setMeta('x', { a: 1 });
  assert.deepEqual(store.getMeta('x'), { a: 1 });
  await store.setMeta('x', undefined);
  assert.equal(store.getMeta('x', 'fallback'), 'fallback');
});
test('settings changes notify subscribers too, so screens can react to timer, week start and flags', async () => {
  const { store } = setup();
  let calls = 0;
  store.subscribe(() => calls++);
  await store.setMeta('weekStart', 1);
  assert.equal(calls, 1);
});
test('version() changes on every notification and only then (a stable snapshot for the UI)', async () => {
  const { store } = setup();
  const v0 = store.version();
  assert.equal(store.version(), v0);
  await store.addCase(input(1));
  const v1 = store.version();
  assert.notEqual(v1, v0);
  await store.addCase(input(1)); // rejected duplicate: nothing changed
  assert.equal(store.version(), v1);
  await store.setMeta('x', 1);
  assert.notEqual(store.version(), v1);
});
