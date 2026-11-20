// Pure calendar-date logic. Dates are local 'YYYY-MM-DD' strings; arithmetic is
// done in UTC so daylight-saving changes can never shift a day.

const pad = n => String(n).padStart(2, '0');
const MS_PER_DAY = 86_400_000;

export function formatISO(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

export function parseISO(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!match) throw new RangeError(`Invalid date: ${s}`);
  const y = +match[1], m = +match[2], d = +match[3];
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) {
    throw new RangeError(`Invalid date: ${s}`);
  }
  return { y, m, d };
}

function toUTC(iso) {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(t) {
  const date = new Date(t);
  return formatISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function assertWeekStart(weekStart) {
  if (!Number.isInteger(weekStart) || weekStart < 0 || weekStart > 6) {
    throw new RangeError(`Invalid weekStart: ${weekStart}`);
  }
}

export function todayLocal(now = new Date()) {
  return formatISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(iso, n) { return fromUTC(toUTC(iso) + n * MS_PER_DAY); }

/** 0 = Sunday .. 6 = Saturday. */
export function dayOfWeek(iso) { return new Date(toUTC(iso)).getUTCDay(); }

/** Signed whole days from a to b. */
export function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY); }

/** weekStart: 0 = Sunday (default), 1 = Monday. */
export function weekRange(iso, weekStart = 0) {
  assertWeekStart(weekStart);
  const start = addDays(iso, -((dayOfWeek(iso) - weekStart + 7) % 7));
  return { start, end: addDays(start, 6) };
}

export function monthRange(iso) {
  const { y, m } = parseISO(iso);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: formatISO(y, m, 1), end: formatISO(y, m, last) };
}

/** July 1 through June 30, the school year containing iso. */
export function schoolYearRange(iso) {
  const { y, m } = parseISO(iso);
  const startYear = m >= 7 ? y : y - 1;
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

/** kind: 'week' | 'month' | 'schoolyear' | 'all'. 'all' returns null (no filter). */
export function rangeFor(kind, iso, weekStart = 0) {
  switch (kind) {
    case 'week': return weekRange(iso, weekStart);
    case 'month': return monthRange(iso);
    case 'schoolyear': return schoolYearRange(iso);
    case 'all': return null;
    default: throw new RangeError(`Unknown range: ${kind}`);
  }
}

/** Inclusive on both ends; a null range matches everything. */
export function inRange(iso, range) {
  return range === null || (iso >= range.start && iso <= range.end);
}

/** month is 1-12. Returns whole weeks of { date, inMonth }. */
export function monthGrid(year, month, weekStart = 0) {
  assertWeekStart(weekStart);
  const first = formatISO(year, month, 1);
  const { end } = monthRange(first);
  const prefix = first.slice(0, 7);
  let cursor = addDays(first, -((dayOfWeek(first) - weekStart + 7) % 7));
  const weeks = [];
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor.startsWith(prefix) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (cursor <= end);
  return weeks;
}
