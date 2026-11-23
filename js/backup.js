// The backup file: how it is built, and how a file she picks is checked before anything is replaced.
import { ACTIVE_LIMIT, activeCount } from './cases.js';
import { createProblems, validateCaseRecord, validateTombstoneRecord } from './backupRecords.js';

export const BACKUP_APP = 'caseload-tracker';
export const BACKUP_VERSION = 1;

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

const reject = errors => ({ ok: false, errors, warnings: [], summary: null, data: null });

/** The first thing wrong with the file as a whole (not a record in it), or null. */
function envelopeProblem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== BACKUP_APP) {
    return 'This is not a Caseload Tracker backup file.';
  }
  if (raw.version !== BACKUP_VERSION) return `Unsupported backup version: ${raw.version}.`;
  if (!Array.isArray(raw.cases)) return 'The backup has no list of cases.';
  return null;
}

function overLimitWarnings(activeCases) {
  if (activeCases <= ACTIVE_LIMIT) return [];
  return [`This backup has ${activeCases} active cases, more than the limit of ${ACTIVE_LIMIT}. You can restore it, but you will need to archive cases before adding new ones.`];
}

/** Parses and strictly validates backup text. On success, `data` holds normalized copies. */
export function validateBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return reject(['This file is not valid JSON.']); }
  const problem = envelopeProblem(raw);
  if (problem) return reject([problem]);

  const problems = createProblems();
  const seen = { caseIds: new Set(), displayKeys: new Set(), entryIds: new Set() };
  const cases = raw.cases
    .map((c, i) => validateCaseRecord(c, `Case ${i + 1}`, seen, problems))
    .filter(Boolean);

  const rawTombstones = raw.tombstones ?? [];
  if (!Array.isArray(rawTombstones)) problems.add('The list of deleted items is invalid.');
  const tombstones = Array.isArray(rawTombstones)
    ? rawTombstones.map((t, i) => validateTombstoneRecord(t, i, problems)).filter(Boolean)
    : [];

  if (problems.any) return reject(problems.messages());

  const activeCases = activeCount(cases);
  return {
    ok: true, errors: [], warnings: overLimitWarnings(activeCases),
    summary: { cases: cases.length, entries: seen.entryIds.size, activeCases },
    data: { cases, tombstones },
  };
}
