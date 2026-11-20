// Pure two-way merge of case data from two devices. Never loses newer data:
// a delete only wins over something that was last changed before the delete.
import { displayIdKey, activeCount, ACTIVE_LIMIT } from './model.js';

const DAY_MS = 86_400_000;
export const TOMBSTONE_TTL_DAYS = 365;
const CASE_FIELDS = ['initials', 'caseNumber', 'displayId', 'dueDate', 'notes', 'archived', 'archivedAt', 'updatedAt'];

const clone = v => JSON.parse(JSON.stringify(v));
const fail = errors => ({ ok: false, errors, warnings: [], data: null, summary: null });

/**
 * local/incoming: { cases, tombstones }. Neither is mutated.
 * Cases match on UUID id first, then on displayId (an ID can be edited, an id cannot).
 * Returns { ok, data, summary, warnings } or { ok: false, errors }.
 */
export function mergeData(local, incoming, nowMs) {
  const cases = clone(local.cases);
  const byId = new Map(cases.map(c => [c.id, c]));
  const byKey = new Map(cases.map(c => [displayIdKey(c.displayId), c]));
  const used = new Set();

  for (const inc of clone(incoming.cases)) {
    const match = byId.get(inc.id) ?? byKey.get(displayIdKey(inc.displayId));
    if (!match) { cases.push(inc); continue; }
    if (used.has(match.id)) {
      return fail([`Two cases in the backup both match ${match.displayId}. Fix the duplicate on the other device and try again.`]);
    }
    used.add(match.id);

    if (inc.updatedAt > match.updatedAt) for (const f of CASE_FIELDS) match[f] = inc[f];

    const entries = new Map(match.entries.map(e => [e.id, e]));
    for (const e of inc.entries) {
      const mine = entries.get(e.id);
      if (!mine || e.updatedAt > mine.updatedAt) entries.set(e.id, e);
    }
    match.entries = [...entries.values()];
  }

  // Union the delete markers, keeping the latest deletedAt for each item.
  const tombs = new Map();
  for (const t of [...local.tombstones, ...incoming.tombstones]) {
    const key = `${t.type}:${t.id}`;
    const have = tombs.get(key);
    if (!have || t.deletedAt > have.deletedAt) tombs.set(key, clone(t));
  }

  for (const c of cases) {
    c.entries = c.entries.filter(e => {
      const t = tombs.get(`entry:${e.id}`);
      return !(t && t.deletedAt > e.updatedAt);
    });
    const ct = tombs.get(`case:${c.id}`);
    if (ct && ct.deletedAt > c.updatedAt) {
      c.entries = c.entries.filter(e => e.updatedAt >= ct.deletedAt);
      c._gone = c.entries.length === 0;
    }
  }
  const merged = cases.filter(c => !c._gone);

  const seen = new Map();
  for (const c of merged) {
    const key = displayIdKey(c.displayId);
    if (seen.has(key)) {
      return fail([`The ID ${c.displayId} would exist twice after merging. Rename or delete one of them on one device, then merge again.`]);
    }
    seen.set(key, c);
  }

  const tombstones = [...tombs.values()].filter(t => t.deletedAt >= nowMs - TOMBSTONE_TTL_DAYS * DAY_MS);
  const active = activeCount(merged);
  const warnings = active > ACTIVE_LIMIT
    ? [`After merging you have ${active} active cases, more than the limit of ${ACTIVE_LIMIT}. Archive some before adding new ones.`]
    : [];
  return { ok: true, errors: [], warnings, data: { cases: merged, tombstones }, summary: summarize(local.cases, merged) };
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
