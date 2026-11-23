// Checks one record (case, entry, deleted-item marker) from a backup file. Each validator reports
// problems into a shared collector and returns the normalized record, so a bad file can be rejected
// with readable messages and a good one comes back in exactly the shape the store keeps.
import { parseISO } from './dates.js';
import { parseName } from './names.js';
import { displayIdKey, isValidCaseNumber, makeDisplayId } from './cases.js';
import { MAX_ENTRY_SECONDS } from './entries.js';

const isObject = v => Boolean(v) && typeof v === 'object';
const isText = v => typeof v === 'string' && v.length > 0;
const isTime = v => Number.isFinite(v) && v >= 0;
const isDate = v => { try { parseISO(v); return true; } catch { return false; } };

/** Keeps the first `max` messages and counts the rest, so a badly broken file stays readable. */
export function createProblems(max = 10) {
  const messages = [];
  let count = 0;
  return {
    add(message) { count++; if (messages.length < max) messages.push(message); },
    get any() { return count > 0; },
    messages() {
      const hidden = count - messages.length;
      return hidden > 0 ? [...messages, `...and ${hidden} more problems.`] : [...messages];
    },
  };
}

function checkId(record, seenIds, where, problems) {
  if (!isText(record.id)) problems.add(`${where} has no id.`);
  else if (seenIds.has(record.id)) problems.add(`${where} repeats the id ${record.id}.`);
  else seenIds.add(record.id);
}

function checkTimestamps(record, where, problems) {
  if (!isTime(record.createdAt)) problems.add(`${where} has an invalid createdAt.`);
  if (record.updatedAt != null && !isTime(record.updatedAt)) problems.add(`${where} has an invalid updatedAt.`);
}

function checkName(c, where, problems) {
  const name = isText(c.initials) ? parseName(c.initials) : null;
  if (!name?.ok || name.value !== c.initials) {
    problems.add(`${where} has invalid initials or name. Only initials, or a first name and last initial, are allowed.`);
  }
  if (!isText(c.caseNumber) || !isValidCaseNumber(c.caseNumber)) problems.add(`${where} has an invalid case number.`);
}

function checkDisplayId(c, where, seenKeys, problems) {
  if (c.displayId !== makeDisplayId(c.initials, c.caseNumber)) {
    problems.add(`${where} has a displayId that does not match its initials and case number.`);
  } else if (seenKeys.has(displayIdKey(c.displayId))) {
    problems.add(`${where} repeats the case ID ${c.displayId}.`);
  } else {
    seenKeys.add(displayIdKey(c.displayId));
  }
}

function checkDuration(e, where, problems) {
  const seconds = e.seconds ?? 0;
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    problems.add(`${where} has invalid seconds.`);
    return;
  }
  const total = e.minutes * 60 + seconds;
  if (!Number.isInteger(e.minutes) || e.minutes < 0 || total < 1 || total > MAX_ENTRY_SECONDS) {
    problems.add(`${where} has an invalid time.`);
  }
}

/** seenIds is the set of entry ids already used in this file. Returns the entry, or null if not an object. */
export function validateEntryRecord(e, where, seenIds, problems) {
  if (!isObject(e)) { problems.add(`${where} is not an object.`); return null; }
  checkId(e, seenIds, where, problems);
  if (!isDate(e.date)) problems.add(`${where} has an invalid date.`);
  checkDuration(e, where, problems);
  if (e.note != null && typeof e.note !== 'string') problems.add(`${where} has an invalid note.`);
  checkTimestamps(e, where, problems);
  return {
    id: e.id, date: e.date, minutes: e.minutes, seconds: e.seconds ?? 0, note: e.note ?? '',
    createdAt: e.createdAt, updatedAt: e.updatedAt ?? e.createdAt,
  };
}

/** seen = { caseIds, displayKeys, entryIds } (sets of ids already used). Returns the case, or null. */
export function validateCaseRecord(c, where, seen, problems) {
  if (!isObject(c)) { problems.add(`${where} is not an object.`); return null; }
  checkId(c, seen.caseIds, where, problems);
  checkName(c, where, problems);
  checkDisplayId(c, where, seen.displayKeys, problems);
  checkTimestamps(c, where, problems);

  const dueDate = c.dueDate == null || c.dueDate === '' ? null : c.dueDate;
  if (dueDate !== null && !isDate(dueDate)) problems.add(`${where} has an invalid due date.`);
  if (c.notes != null && typeof c.notes !== 'string') problems.add(`${where} has invalid notes.`);
  if (typeof c.archived !== 'boolean') problems.add(`${where} must say whether it is archived.`);
  if (!Array.isArray(c.entries)) { problems.add(`${where} has no list of entries.`); return null; }

  const entries = c.entries.map((e, i) => validateEntryRecord(e, `${where}, entry ${i + 1}`, seen.entryIds, problems));
  return {
    id: c.id, initials: c.initials, caseNumber: c.caseNumber, displayId: c.displayId,
    createdAt: c.createdAt, updatedAt: c.updatedAt ?? c.createdAt, dueDate,
    notes: c.notes ?? '', archived: c.archived, archivedAt: c.archivedAt ?? null,
    entries: entries.filter(Boolean),
  };
}

export function validateTombstoneRecord(t, index, problems) {
  const valid = isObject(t) && (t.type === 'case' || t.type === 'entry') && isText(t.id) && isTime(t.deletedAt);
  if (!valid) { problems.add(`Deleted item ${index + 1} is invalid.`); return null; }
  return { type: t.type, id: t.id, ...(t.caseId ? { caseId: t.caseId } : {}), deletedAt: t.deletedAt };
}
