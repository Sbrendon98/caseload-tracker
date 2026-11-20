// The app's data API. Keeps an in-memory snapshot (so reads are synchronous, which the iOS
// share sheet needs) and writes through to the db adapter. Writes run one at a time, and the
// snapshot only changes after the db write succeeded.
import { validateCase, validateEntry, canAddActive } from './model.js';
import { mergeData } from './merge.js';

const tombKey = t => `${t.type}:${t.id}`;

export function createStore(db, { now = Date.now, uuid = () => crypto.randomUUID() } = {}) {
  let state = { cases: [], tombstones: [], meta: {} };
  const listeners = new Set();
  let chain = Promise.resolve();

  const emit = () => listeners.forEach(fn => fn());
  const serial = fn => {
    const run = chain.then(fn);
    chain = run.catch(() => {});
    return run;
  };
  const find = id => state.cases.find(c => c.id === id);

  async function commit({ putCases = [], deleteCaseIds = [], putTombstones = [] }) {
    await db.apply({ putCases, deleteCaseIds, putTombstones });
    const removed = new Set(deleteCaseIds);
    const cases = state.cases.filter(c => !removed.has(c.id));
    for (const c of putCases) {
      const i = cases.findIndex(x => x.id === c.id);
      if (i >= 0) cases[i] = c; else cases.push(c);
    }
    const tombs = new Map(state.tombstones.map(t => [tombKey(t), t]));
    for (const t of putTombstones) tombs.set(tombKey(t), t);
    state = { ...state, cases, tombstones: [...tombs.values()] };
    emit();
  }

  const newestFirst = (a, b) => b.createdAt - a.createdAt;

  return {
    // ---- reads (synchronous, from the snapshot; treat results as read-only) ----
    cases: () => state.cases,
    tombstones: () => state.tombstones,
    getCase: id => find(id),
    activeNewestFirst: () => state.cases.filter(c => !c.archived).sort(newestFirst),
    activeOldestFirst: () => state.cases.filter(c => !c.archived).sort((a, b) => a.createdAt - b.createdAt),
    archivedNewestFirst: () => state.cases.filter(c => c.archived).sort((a, b) => b.archivedAt - a.archivedAt),
    getMeta: (key, fallback) => (key in state.meta ? state.meta[key] : fallback),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // ---- lifecycle ----
    load: () => serial(async () => {
      const data = await db.getAll();
      state = { cases: data.cases, tombstones: data.tombstones, meta: data.meta };
      emit();
    }),

    // ---- cases ----
    addCase: input => serial(async () => {
      const v = validateCase(input, state.cases);
      if (!v.ok) return { ok: false, errors: v.errors };
      if (!canAddActive(state.cases)) return { ok: false, reason: 'limit' };
      const t = now();
      const created = { id: uuid(), ...v.value, createdAt: t, updatedAt: t, archived: false, archivedAt: null, entries: [] };
      await commit({ putCases: [created] });
      return { ok: true, case: created };
    }),

    updateCase: (id, input) => serial(async () => {
      const current = find(id);
      if (!current) return { ok: false, reason: 'notfound' };
      const v = validateCase(input, state.cases, { exceptId: id });
      if (!v.ok) return { ok: false, errors: v.errors };
      const next = { ...current, ...v.value, updatedAt: now() };
      await commit({ putCases: [next] });
      return { ok: true, case: next };
    }),

    archive: id => serial(async () => {
      const current = find(id);
      if (!current) return { ok: false, reason: 'notfound' };
      if (current.archived) return { ok: true, case: current };
      const t = now();
      const next = { ...current, archived: true, archivedAt: t, updatedAt: t };
      await commit({ putCases: [next] });
      return { ok: true, case: next };
    }),

    unarchive: id => serial(async () => {
      const current = find(id);
      if (!current) return { ok: false, reason: 'notfound' };
      if (!current.archived) return { ok: true, case: current };
      if (!canAddActive(state.cases)) return { ok: false, reason: 'limit' };
      const next = { ...current, archived: false, archivedAt: null, updatedAt: now() };
      await commit({ putCases: [next] });
      return { ok: true, case: next };
    }),

    deleteCase: id => serial(async () => {
      if (!find(id)) return { ok: false, reason: 'notfound' };
      await commit({ deleteCaseIds: [id], putTombstones: [{ type: 'case', id, deletedAt: now() }] });
      return { ok: true };
    }),

    // ---- entries (a case's own updatedAt only changes when the case itself is edited) ----
    addEntry: (caseId, input) => serial(async () => {
      const current = find(caseId);
      if (!current) return { ok: false, reason: 'notfound' };
      const v = validateEntry(input);
      if (!v.ok) return { ok: false, errors: v.errors };
      const t = now();
      const entry = { id: uuid(), ...v.value, createdAt: t, updatedAt: t };
      await commit({ putCases: [{ ...current, entries: [...current.entries, entry] }] });
      return { ok: true, entry };
    }),

    updateEntry: (caseId, entryId, input) => serial(async () => {
      const current = find(caseId);
      const old = current?.entries.find(e => e.id === entryId);
      if (!old) return { ok: false, reason: 'notfound' };
      const v = validateEntry(input);
      if (!v.ok) return { ok: false, errors: v.errors };
      const entry = { ...old, ...v.value, updatedAt: now() };
      await commit({ putCases: [{ ...current, entries: current.entries.map(e => (e.id === entryId ? entry : e)) }] });
      return { ok: true, entry };
    }),

    deleteEntry: (caseId, entryId) => serial(async () => {
      const current = find(caseId);
      if (!current?.entries.some(e => e.id === entryId)) return { ok: false, reason: 'notfound' };
      await commit({
        putCases: [{ ...current, entries: current.entries.filter(e => e.id !== entryId) }],
        putTombstones: [{ type: 'entry', id: entryId, caseId, deletedAt: now() }],
      });
      return { ok: true };
    }),

    // ---- restore / merge ----
    replaceAll: data => serial(async () => {
      await db.replaceAll(data);
      state = { ...state, cases: data.cases, tombstones: data.tombstones };
      emit();
      return { ok: true };
    }),

    applyMerge: incoming => serial(async () => {
      const result = mergeData({ cases: state.cases, tombstones: state.tombstones }, incoming, now());
      if (!result.ok) return result;
      await db.replaceAll(result.data);
      state = { ...state, cases: result.data.cases, tombstones: result.data.tombstones };
      emit();
      return result;
    }),

    // ---- settings, timer, drafts, tutorial flags. undefined deletes the key. No change event. ----
    setMeta: (key, value) => serial(async () => {
      await db.setMeta(key, value);
      const meta = { ...state.meta };
      if (value === undefined) delete meta[key]; else meta[key] = value;
      state = { ...state, meta };
    }),
  };
}
