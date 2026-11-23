// Rules for a case: its ID, uniqueness, the active-case limit, due dates and search.
import { daysBetween, parseISO } from './dates.js';
import { parseName } from './names.js';

export const ACTIVE_LIMIT = 50;
export const MAX_CASE_NUMBER = 10;

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

export const activeCount = cases => cases.filter(c => !c.archived).length;
export const canAddActive = (cases, limit = ACTIVE_LIMIT) => activeCount(cases) < limit;

/** 'overdue' | 'soon' (today through soonDays ahead) | null (no due date or later). */
export function dueStatus(dueISO, todayISO, soonDays = 7) {
  if (!dueISO) return null;
  const days = daysBetween(todayISO, dueISO);
  if (days < 0) return 'overdue';
  return days <= soonDays ? 'soon' : null;
}

const squash = s => String(s ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Search ignores case, dots and dashes: "as1224" finds "A.S-122445543". Empty query matches all. */
export const matchesSearch = (displayId, query) => squash(displayId).includes(squash(query));
