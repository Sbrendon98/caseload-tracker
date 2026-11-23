// Pure backup format: build, validate, and the small "should we nudge her" rules.
import { parseISO } from './dates.js';
import { parseName, isValidCaseNumber, makeDisplayId, displayIdKey, activeCount, ACTIVE_LIMIT } from './model.js';

export const BACKUP_APP = 'caseload-tracker';
export const BACKUP_VERSION = 1;
const MAX_ERRORS = 10;
const BACKUP_NUDGE_DAYS = 14;
const DAY_MS = 86_400_000;

export function buildBackup({ cases, tombstones }, nowMs = Date.now()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date(nowMs).toISOString(),
    cases,
    tombstones,
  };
}

export const backupFilename = todayISO => `caseload-backup-${todayISO}.json`;

const isText = v => typeof v === 'string' && v.length > 0;
const isTime = v => Number.isFinite(v) && v >= 0;
const isDate = v => { try { parseISO(v); return true; } catch { return false; } };

function fail(errors) {
  return { ok: false, errors, warnings: [], summary: null, data: null };
}

/** Parses and strictly validates backup text. On success, `data` holds normalized copies. */
export function validateBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return fail(['This file is not valid JSON.']); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== BACKUP_APP) {
    return fail(['This is not a Caseload Tracker backup file.']);
  }
  if (raw.version !== BACKUP_VERSION) return fail([`Unsupported backup version: ${raw.version}.`]);
  if (!Array.isArray(raw.cases)) return fail(['The backup has no list of cases.']);

  const errors = [];
  let errorCount = 0;
  const addError = msg => { errorCount++; if (errors.length < MAX_ERRORS) errors.push(msg); };

  const caseIds = new Set();
  const displayKeys = new Set();
  const entryIds = new Set();
  const cases = [];

  raw.cases.forEach((c, ci) => {
    const where = `Case ${ci + 1}`;
    if (!c || typeof c !== 'object') return addError(`${where} is not an object.`);
    if (!isText(c.id)) addError(`${where} has no id.`);
    else if (caseIds.has(c.id)) addError(`${where} repeats the id ${c.id}.`);
    else caseIds.add(c.id);

    const name = isText(c.initials) ? parseName(c.initials) : null;
    if (!name?.ok || name.value !== c.initials) addError(`${where} has invalid initials or name. Only initials, or a first name and last initial, are allowed.`);
    if (!isText(c.caseNumber) || !isValidCaseNumber(c.caseNumber)) addError(`${where} has an invalid case number.`);
    if (c.displayId !== makeDisplayId(c.initials, c.caseNumber)) addError(`${where} has a displayId that does not match its initials and case number.`);
    else if (displayKeys.has(displayIdKey(c.displayId))) addError(`${where} repeats the case ID ${c.displayId}.`);
    else displayKeys.add(displayIdKey(c.displayId));

    if (!isTime(c.createdAt)) addError(`${where} has an invalid createdAt.`);
    if (c.updatedAt != null && !isTime(c.updatedAt)) addError(`${where} has an invalid updatedAt.`);
    const due = c.dueDate == null || c.dueDate === '' ? null : c.dueDate;
    if (due !== null && !isDate(due)) addError(`${where} has an invalid due date.`);
    if (c.notes != null && typeof c.notes !== 'string') addError(`${where} has invalid notes.`);
    if (typeof c.archived !== 'boolean') addError(`${where} must say whether it is archived.`);
    if (!Array.isArray(c.entries)) { addError(`${where} has no list of entries.`); return; }

    const entries = [];
    c.entries.forEach((e, ei) => {
      const ew = `${where}, entry ${ei + 1}`;
      if (!e || typeof e !== 'object') return addError(`${ew} is not an object.`);
      if (!isText(e.id)) addError(`${ew} has no id.`);
      else if (entryIds.has(e.id)) addError(`${ew} repeats the id ${e.id}.`);
      else entryIds.add(e.id);
      if (!isDate(e.date)) addError(`${ew} has an invalid date.`);
      const secs = e.seconds ?? 0;
      if (!Number.isInteger(secs) || secs < 0 || secs > 59) addError(`${ew} has invalid seconds.`);
      else if (!Number.isInteger(e.minutes) || e.minutes < 0 || e.minutes > 24 * 60 || e.minutes * 60 + secs < 1 || e.minutes * 60 + secs > 24 * 3600) addError(`${ew} has an invalid time.`);
      if (e.note != null && typeof e.note !== 'string') addError(`${ew} has an invalid note.`);
      if (!isTime(e.createdAt)) addError(`${ew} has an invalid createdAt.`);
      if (e.updatedAt != null && !isTime(e.updatedAt)) addError(`${ew} has an invalid updatedAt.`);
      entries.push({
        id: e.id, date: e.date, minutes: e.minutes, seconds: e.seconds ?? 0, note: e.note ?? '',
        createdAt: e.createdAt, updatedAt: e.updatedAt ?? e.createdAt,
      });
    });

    cases.push({
      id: c.id, initials: c.initials, caseNumber: c.caseNumber, displayId: c.displayId,
      createdAt: c.createdAt, updatedAt: c.updatedAt ?? c.createdAt, dueDate: due,
      notes: c.notes ?? '', archived: c.archived, archivedAt: c.archivedAt ?? null, entries,
    });
  });

  const tombstones = [];
  const rawTombs = raw.tombstones ?? [];
  if (!Array.isArray(rawTombs)) addError('The list of deleted items is invalid.');
  else {
    rawTombs.forEach((t, ti) => {
      if (!t || (t.type !== 'case' && t.type !== 'entry') || !isText(t.id) || !isTime(t.deletedAt)) {
        return addError(`Deleted item ${ti + 1} is invalid.`);
      }
      tombstones.push({ type: t.type, id: t.id, ...(t.caseId ? { caseId: t.caseId } : {}), deletedAt: t.deletedAt });
    });
  }

  if (errorCount > 0) {
    if (errorCount > errors.length) errors.push(`...and ${errorCount - errors.length} more problems.`);
    return fail(errors);
  }

  const active = activeCount(cases);
  const warnings = active > ACTIVE_LIMIT
    ? [`This backup has ${active} active cases, more than the limit of ${ACTIVE_LIMIT}. You can restore it, but you will need to archive cases before adding new ones.`]
    : [];
  return {
    ok: true, errors: [], warnings,
    summary: { cases: cases.length, entries: entryIds.size, activeCases: active },
    data: { cases, tombstones },
  };
}

/** iOS home-screen apps have storage separate from Safari tabs; warn when data sits in a tab. */
export function shouldWarnNotInstalled({ isIOS, isStandalone, caseCount }) {
  return Boolean(isIOS) && !isStandalone && caseCount > 0;
}

/** True after 14 days without a backup (counted from the oldest case if she never backed up). */
export function backupDue({ lastBackupMs, cases, nowMs, days = BACKUP_NUDGE_DAYS }) {
  if (cases.length === 0) return false;
  const baseline = lastBackupMs ?? Math.min(...cases.map(c => c.createdAt));
  return nowMs - baseline >= days * DAY_MS;
}
