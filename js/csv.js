// Pure CSV export: one row per case, Excel-friendly (UTF-8 BOM, CRLF). Each row has the case's total
// time in words and a single cell listing every date and time worked, so a supervisor reads one line
// per student instead of one per time entry.
import { inRange, parseISO } from './dates.js';
import { decimalHours, durationInWords, durationShort, entrySeconds, totalSeconds } from './durations.js';

/** Whole minutes, rounded up, so a 4 second timer entry reads as 1 minute rather than 0. */
const ceilMinutes = seconds => Math.ceil(seconds / 60);

export const BOM = '\uFEFF';
export const HEADERS = [
  'Initials', 'Case Number', 'Total Time', 'Decimal Hours',
  'Dates and Times', 'Case Due Date', 'Case Notes',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A cell starting with these is a formula to a spreadsheet; prefix a quote to keep it text.
// A "-" is only treated that way when it is not followed by whitespace, so "- met with teacher" stays clean.
const FORMULA_START = /^[=+@\t\r]|^-(?!\s)/;

export function escapeField(value) {
  let s = value == null ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "2026-11-16" -> "Nov 16, 2026". English month names so the file reads the same on any device. */
function prettyDate(iso) {
  const { y, m, d } = parseISO(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const oneLine = text => String(text ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();

/** The entries inside the range, oldest first. */
function entriesInRange(c, range) {
  return c.entries
    .filter(e => inRange(e.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** How many cases and entries an export of this range will contain. */
export function rangeSummary(cases, range) {
  let caseCount = 0;
  let entryCount = 0;
  for (const c of cases) {
    const n = entriesInRange(c, range).length;
    if (n > 0) { caseCount++; entryCount += n; }
  }
  return { cases: caseCount, entries: entryCount };
}

/**
 * range: {start, end} inclusive, or null for everything. Archived cases are included.
 * Only cases with time inside the range get a row, sorted by case ID (which is not itself a column).
 */
export function buildCsv(cases, range) {
  const rows = [];
  for (const c of cases) {
    const entries = entriesInRange(c, range);
    if (entries.length === 0) continue;
    const minutes = ceilMinutes(totalSeconds(entries));
    const dates = entries
      .map(e => `${prettyDate(e.date)}: ${durationShort(ceilMinutes(entrySeconds(e)))}${e.note ? ` (${oneLine(e.note)})` : ''}`)
      .join('; ');
    rows.push({
      sortKey: c.displayId,
      cells: [
        c.initials, c.caseNumber,
        durationInWords(minutes), decimalHours(minutes), dates,
        c.dueDate ?? '', c.notes ?? '',
      ],
    });
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const lines = [HEADERS, ...rows.map(r => r.cells)];
  return BOM + lines.map(r => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}

export const exportFilename = (kind, startISO) => `caseload-${kind}-${startISO}.csv`;
