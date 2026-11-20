// Pure CSV export: one row per time entry, Excel-friendly (UTF-8 BOM, CRLF).
import { inRange } from './dates.js';
import { decimalHours } from './model.js';

export const BOM = '\uFEFF';
export const HEADERS = [
  'Case ID', 'Initials', 'Case Number', 'Entry Date', 'Hours', 'Minutes', 'Total Minutes',
  'Decimal Hours', 'Note', 'Case Due Date', 'Archived', 'Case Notes',
];

// A cell starting with these is a formula to a spreadsheet; prefix a quote to keep it text.
// A "-" is only treated that way when it is not followed by whitespace, so "- met with teacher" stays clean.
const FORMULA_START = /^[=+@\t\r]|^-(?!\s)/;

export function escapeField(value) {
  let s = value == null ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** range: {start, end} inclusive, or null for everything. Archived cases are included. */
export function buildCsv(cases, range) {
  const rows = [];
  for (const c of cases) {
    for (const e of c.entries) if (inRange(e.date, range)) rows.push([c, e]);
  }
  rows.sort((a, b) =>
    a[1].date.localeCompare(b[1].date) ||
    a[0].displayId.localeCompare(b[0].displayId) ||
    (a[1].createdAt ?? 0) - (b[1].createdAt ?? 0));

  const lines = [HEADERS, ...rows.map(([c, e]) => [
    c.displayId, c.initials, c.caseNumber, e.date,
    Math.floor(e.minutes / 60), e.minutes % 60, e.minutes, decimalHours(e.minutes),
    e.note ?? '', c.dueDate ?? '', c.archived ? 'Yes' : 'No', c.notes ?? '',
  ])];
  return BOM + lines.map(r => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}

export const exportFilename = (kind, startISO) => `caseload-${kind}-${startISO}.csv`;
