// Pure two-way merge of case data from two devices. Never loses newer data:
// a delete only wins over something that was last changed before the delete.
import { ACTIVE_LIMIT, activeCount, displayIdKey } from './cases.js';

const DAY_MS = 86_400_000;
export const TOMBSTONE_TTL_DAYS = 365;
const CASE_FIELDS = ['initials', 'caseNumber', 'displayId', 'dueDate', 'notes', 'archived', 'archivedAt', 'updatedAt'];

const clone = v => JSON.parse(JSON.stringify(v));
const fail = errors => ({ ok: false, errors, warnings: [], data: null, summary: null });

/** Adds the incoming entries to a case: the same id keeps whichever side was edited last. */
function mergeEntries(mine, incoming) {
  const byId = new Map(mine.map(e => [e.id, e]));
  for (const e of incoming) {
    const existing = byId.get(e.id);
    if (!existing || e.updatedAt > existing.updatedAt) byId.set(e.id, e);
  }
  return [...byId.values()];
}

/** Folds the incoming cases into `cases` (mutates it). Cases match on UUID id first, then on displayId. */
function mergeCases(cases, incoming) {
  const byId = new Map(cases.map(c => [c.id, c]));
  const byKey = new Map(cases.map(c => [displayIdKey(c.displayId), c]));
  const matched = new Set();

  for (const inc of incoming) {
    const match = byId.get(inc.id) ?? byKey.get(displayIdKey(inc.displayId));
    if (!match) { cases.push(inc); continue; }
    if (matched.has(match.id)) {
      return `Two cases in the backup both match ${match.displayId}. Fix the duplicate on the other device and try again.`;
    }
    matched.add(match.id);
    if (inc.updatedAt > match.updatedAt) for (const f of CASE_FIELDS) match[f] = inc[f];
    match.entries = mergeEntries(match.entries, inc.entries);
  }
  return null;
}

/** One delete marker per item, keeping the latest deletedAt. */
function unionTombstones(...lists) {
  const byItem = new Map();
  for (const t of lists.flat()) {
    const key = `${t.type}:${t.id}`;
    const have = byItem.get(key);
    if (!have || t.deletedAt > have.deletedAt) byItem.set(key, clone(t));
  }
  return byItem;
}

/** Applies deletes to the cases and returns the survivors. A delete never beats a later edit. */
function applyTombstones(cases, tombstones) {
  const survivors = [];
  for (const c of cases) {
    c.entries = c.entries.filter(e => {
      const t = tombstones.get(`entry:${e.id}`);
      return !(t && t.deletedAt > e.updatedAt);
    });
    const caseTombstone = tombstones.get(`case:${c.id}`);
    if (caseTombstone && caseTombstone.deletedAt > c.updatedAt) {
      c.entries = c.entries.filter(e => e.updatedAt >= caseTombstone.deletedAt);
      if (c.entries.length === 0) continue; // nothing newer than the delete is left
    }
    survivors.push(c);
  }
  return survivors;
}

/** The first case ID that two different cases would share, or null. */
function firstDuplicateId(cases) {
  const seen = new Set();
  for (const c of cases) {
    const key = displayIdKey(c.displayId);
    if (seen.has(key)) return c.displayId;
    seen.add(key);
  }
  return null;
}

const notExpired = nowMs => t => t.deletedAt >= nowMs - TOMBSTONE_TTL_DAYS * DAY_MS;

function overLimitWarnings(activeCases) {
  if (activeCases <= ACTIVE_LIMIT) return [];
  return [`After merging you have ${activeCases} active cases, more than the limit of ${ACTIVE_LIMIT}. Archive some before adding new ones.`];
}

/**
 * local/incoming: { cases, tombstones }. Neither is mutated.
 * Returns { ok, data, summary, warnings } or { ok: false, errors }.
 */
export function mergeData(local, incoming, nowMs) {
  const cases = clone(local.cases);
  const conflict = mergeCases(cases, clone(incoming.cases));
  if (conflict) return fail([conflict]);

  const tombstones = unionTombstones(local.tombstones, incoming.tombstones);
  const merged = applyTombstones(cases, tombstones);

  const duplicate = firstDuplicateId(merged);
  if (duplicate) {
    return fail([`The ID ${duplicate} would exist twice after merging. Rename or delete one of them on one device, then merge again.`]);
  }

  return {
    ok: true, errors: [],
    warnings: overLimitWarnings(activeCount(merged)),
    data: { cases: merged, tombstones: [...tombstones.values()].filter(notExpired(nowMs)) },
    summary: summarize(local.cases, merged),
  };
}

function summarize(before, after) {
  const beforeCases = new Map(before.map(c => [c.id, c]));
  const afterCases = new Map(after.map(c => [c.id, c]));
  const beforeEntries = new Map(before.flatMap(c => c.entries.map(e => [e.id, e])));
  const afterEntries = new Map(after.flatMap(c => c.entries.map(e => [e.id, e])));
  const count = (map, other, predicate) => [...map].filter(([id, v]) => predicate(v, other.get(id))).length;
  return {
    casesAdded: count(afterCases, beforeCases, (_, old) => !old),
    casesUpdated: count(afterCases, beforeCases, (c, old) => old && CASE_FIELDS.some(f => c[f] !== old[f])),
    casesRemoved: count(beforeCases, afterCases, (_, now) => !now),
    entriesAdded: count(afterEntries, beforeEntries, (_, old) => !old),
    entriesUpdated: count(afterEntries, beforeEntries, (e, old) => old && e.updatedAt !== old.updatedAt),
    entriesRemoved: count(beforeEntries, afterEntries, (_, now) => !now),
  };
}
