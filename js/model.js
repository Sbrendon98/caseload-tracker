// Pure case/entry rules: normalization, validation, totals, the active-case limit.
import { parseISO, daysBetween } from './dates.js';

export const ACTIVE_LIMIT = 50;
export const MAX_CASE_NUMBER = 10;
export const MAX_ENTRY_MINUTES = 24 * 60;

const NAME_HELP = 'Enter a first name and last initial (Jane D.) or initials (J.D). A full last name is not accepted.';
const MAX_INITIALS = 4;
const MAX_FIRST_NAME_LETTERS = 20;

const letterCount = token => (token.match(/\p{L}/gu) ?? []).length;
const isAllUpper = token => token === token.toUpperCase() && token !== token.toLowerCase();
const capitalizeName = token =>
  token.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

/**
 * How a student is shown: initials ("A.S") or a first name plus last initial ("Jane D.").
 * Returns { ok, value, error }. A full last name, a lone first name, more than 4 initials,
 * or no letters is rejected. Short ALL-CAPS words ("AL D") count as initials, not a name.
 */
export function parseName(raw) {
  const fail = { ok: false, value: '', error: NAME_HELP };
  const cleaned = String(raw ?? '').replace(/’/g, "'").replace(/[^\p{L}\s.'-]/gu, '');
  const tokens = cleaned.split(/[\s.]+/).map(t => t.replace(/^[-']+|[-']+$/g, '')).filter(t => letterCount(t) > 0);
  if (tokens.length === 0) return fail;

  const [first, second] = tokens;
  const shortCaps = tokens.length === 2 && isAllUpper(first) && letterCount(first) <= 3;
  if (tokens.length === 2 && letterCount(second) === 1 && letterCount(first) >= 2 && !shortCaps) {
    if (letterCount(first) > MAX_FIRST_NAME_LETTERS) return fail;
    return { ok: true, value: `${capitalizeName(first)} ${second.toUpperCase()}.`, error: null };
  }

  const looksLikeInitials = tokens.every(t => letterCount(t) === 1)
    || tokens.every(isAllUpper)
    || (tokens.length === 1 && letterCount(first) <= 3);
  const letters = tokens.join('').match(/\p{L}/gu) ?? [];
  if (looksLikeInitials && letters.length <= MAX_INITIALS) {
    return { ok: true, value: letters.map(c => c.toUpperCase()).join('.'), error: null };
  }
  return fail;
}

/** Always a trimmed string so leading zeros ("00123") survive. */
export function normalizeCaseNumber(raw) { return String(raw ?? '').trim(); }

export const isValidCaseNumber = s => s.length <= MAX_CASE_NUMBER && /^[A-Za-z0-9]+$/.test(s);

export const makeDisplayId = (initials, caseNumber) => `${initials}-${caseNumber}`;
export const displayIdKey = displayId => displayId.toUpperCase();

/** Case-insensitive, across active and archived. exceptId lets a case be edited without matching itself. */
export function findDuplicate(cases, displayId, exceptId = null) {
  const key = displayIdKey(displayId);
  return cases.find(c => c.id !== exceptId && displayIdKey(c.displayId) === key) ?? null;
}

export function validateCase(input, cases, { exceptId = null } = {}) {
  const errors = {};
  const parsed = parseName(input.initials);
  const initials = parsed.value;
  const caseNumber = normalizeCaseNumber(input.caseNumber);
  if (!parsed.ok) errors.initials = parsed.error;
  if (!isValidCaseNumber(caseNumber)) errors.caseNumber = `Enter a case number, up to ${MAX_CASE_NUMBER} letters or numbers.`;

  let dueDate = null;
  const rawDue = String(input.dueDate ?? '').trim();
  if (rawDue) {
    try { parseISO(rawDue); dueDate = rawDue; }
    catch { errors.dueDate = 'Enter a valid due date.'; }
  }

  let displayId = null;
  if (!errors.initials && !errors.caseNumber) {
    displayId = makeDisplayId(initials, caseNumber);
    const dup = findDuplicate(cases, displayId, exceptId);
    if (dup) {
      errors.duplicate = `A case with ID ${displayId} already exists${dup.archived ? ' in your archive' : ''}.`;
    }
  }
  const notes = String(input.notes ?? '').trim();
  return { ok: Object.keys(errors).length === 0, errors, value: { initials, caseNumber, displayId, dueDate, notes } };
}

function toWhole(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export function validateEntry(input) {
  const errors = {};
  const hours = toWhole(input.hours);
  const minutes = toWhole(input.minutes);
  if (!(hours >= 0)) errors.hours = 'Hours must be a whole number, 0 or more.';
  if (!(minutes >= 0 && minutes <= 59)) errors.minutes = 'Minutes must be a whole number from 0 to 59.';

  const date = String(input.date ?? '').trim();
  try { parseISO(date); } catch { errors.date = 'Enter a valid date.'; }

  const seconds = toWhole(input.seconds);
  if (!(seconds >= 0 && seconds <= 59)) errors.seconds = 'Seconds must be a whole number from 0 to 59.';

  const total = hours * 60 + minutes;
  if (!errors.hours && !errors.minutes && !errors.seconds) {
    const totalSec = total * 60 + seconds;
    if (totalSec <= 0) errors.total = 'Enter a time greater than 0.';
    else if (totalSec > MAX_ENTRY_MINUTES * 60) errors.total = 'A single entry cannot be more than 24 hours.';
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { date, minutes: total, seconds, note: String(input.note ?? '').trim() },
  };
}

export const totalMinutes = entries => entries.reduce((sum, e) => sum + e.minutes, 0);

/** Entries made before seconds existed have none. */
export const entrySeconds = e => e.minutes * 60 + (e.seconds ?? 0);
export const totalSeconds = entries => entries.reduce((sum, e) => sum + entrySeconds(e), 0);

/** 5442 -> "1h 30m 42s". Shown for case totals and entries in the app. */
export function formatDurationSeconds(sec) {
  const t = Math.max(0, Math.round(sec));
  return `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m ${t % 60}s`;
}

export function formatDuration(min) {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** 73 -> "1 hour and 13 minutes". Used for the total in the CSV. */
export function durationInWords(min) {
  const m = Math.max(0, Math.round(min));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours === 0) return plural(minutes, 'minute');
  if (minutes === 0) return plural(hours, 'hour');
  return `${plural(hours, 'hour')} and ${plural(minutes, 'minute')}`;
}

/** 75 -> "1 hr 15 min". Compact form for the per-day list in the CSV. */
export function durationShort(min) {
  const m = Math.max(0, Math.round(min));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

export const decimalHours = min => (min / 60).toFixed(2);

export const activeCount = cases => cases.filter(c => !c.archived).length;
export const canAddActive = (cases, limit = ACTIVE_LIMIT) => activeCount(cases) < limit;

/** 'overdue' | 'soon' (today through soonDays ahead) | null (no due date or later). */
export function dueStatus(dueISO, todayISO, soonDays = 7) {
  if (!dueISO) return null;
  const days = daysBetween(todayISO, dueISO);
  if (days < 0) return 'overdue';
  return days <= soonDays ? 'soon' : null;
}

/** Whole minutes between two timestamps (ms), rounded up, never below 1. */
export function elapsedMinutes(startMs, nowMs) {
  return Math.max(1, Math.ceil((nowMs - startMs) / 60_000));
}

const squash = s => String(s ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Search ignores case, dots and dashes: "as1224" finds "A.S-122445543". Empty query matches all. */
export const matchesSearch = (displayId, query) => squash(displayId).includes(squash(query));

/**
 * Stopping a timer. Returns { ok: true, minutes } or { ok: false, reason: 'too-long' } when it has run
 * past the 24-hour entry limit (she probably forgot it), so the caller can ask instead of guessing.
 */
export function timerStop(startMs, nowMs) {
  const total = Math.max(1, Math.floor((nowMs - startMs) / 1000)); // whole seconds, never a zero-length entry
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return total > MAX_ENTRY_MINUTES * 60 ? { ok: false, reason: 'too-long', minutes, seconds } : { ok: true, minutes, seconds };
}

/** A corrected timer start must be a real time and cannot be in the future. */
export function validateTimerStart(startMs, nowMs) {
  if (!Number.isFinite(startMs)) return { ok: false, error: 'Enter a valid date and time.' };
  if (startMs > nowMs) return { ok: false, error: 'The start time cannot be in the future.' };
  return { ok: true, error: null };
}
