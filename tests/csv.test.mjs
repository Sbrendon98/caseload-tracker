import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { BOM, HEADERS, escapeField, buildCsv, rangeSummary, exportFilename } from '../js/csv.js';

const aCase = (over = {}) => ({
  id: '1', displayId: 'Jane D.-122', initials: 'Jane D.', caseNumber: '122',
  dueDate: '2026-12-01', archived: false, notes: '', entries: [], ...over,
});
const entry = (date, minutes, over = {}) => ({ id: `${date}-${minutes}`, date, minutes, note: '', createdAt: 1, ...over });
const dataRows = csv => csv.slice(1).split('\r\n').slice(1, -1);
const WEEK = { start: '2026-11-15', end: '2026-11-21' };

test('HEADERS: one row per case, with total time in words and a dates-and-times column', () => {
  assert.deepEqual(HEADERS, [
    'Initials', 'Case Number', 'Total Time', 'Decimal Hours', 'Dates and Times', 'Case Due Date', 'Case Notes',
  ]);
});
test('escapeField: plain, comma, quote, newline, null', () => {
  assert.equal(escapeField('plain'), 'plain');
  assert.equal(escapeField('a,b'), '"a,b"');
  assert.equal(escapeField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeField('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeField('line1\r\nline2'), '"line1\r\nline2"');
  assert.equal(escapeField(null), '');
  assert.equal(escapeField(undefined), '');
  assert.equal(escapeField(0), '0');
});
test('escapeField neutralises spreadsheet formulas', () => {
  assert.equal(escapeField('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(escapeField('+1'), "'+1");
  assert.equal(escapeField('@cmd'), "'@cmd");
  assert.equal(escapeField('-5'), "'-5");
  assert.equal(escapeField('- met with teacher'), '- met with teacher');
});

test('several entries for one case become ONE row: total in words, and each date and time listed', () => {
  const c = aCase({ entries: [entry('2026-11-18', 28), entry('2026-11-16', 45)] });
  const csv = buildCsv([c], WEEK);
  assert.ok(csv.startsWith(BOM));
  assert.equal(csv.slice(1).split('\r\n')[0], HEADERS.join(','));
  assert.deepEqual(dataRows(csv), [
    'Jane D.,122,1 hour and 13 minutes,1.22,"Nov 16, 2026: 45 min; Nov 18, 2026: 28 min",2026-12-01,',
  ]);
});
test('only entries inside the range count, inclusive at both ends', () => {
  const c = aCase({ entries: [entry('2026-11-14', 100), entry('2026-11-15', 10), entry('2026-11-21', 20), entry('2026-11-22', 100)] });
  const [row] = dataRows(buildCsv([c], WEEK));
  assert.match(row, /,30 minutes,0\.50,/);
  assert.match(row, /Nov 15, 2026: 10 min; Nov 21, 2026: 20 min/);
  assert.doesNotMatch(row, /Nov 14|Nov 22/);
});
test('a null range exports everything', () => {
  const c = aCase({ entries: [entry('2025-01-01', 60), entry('2026-11-16', 60)] });
  assert.match(dataRows(buildCsv([c], null))[0], /,2 hours,2\.00,/);
});
test('cases with no time in the range are left out; none at all gives a header-only file', () => {
  const quiet = aCase({ id: '2', displayId: 'Q.Q-1', entries: [entry('2026-10-01', 30)] });
  assert.equal(buildCsv([aCase(), quiet], WEEK), BOM + HEADERS.join(',') + '\r\n');
});
test('archived cases are included, and there is no Archived column', () => {
  const c = aCase({ archived: true, entries: [entry('2026-11-16', 30)] });
  assert.equal(dataRows(buildCsv([c], WEEK)).length, 1);
  assert.ok(!HEADERS.includes('Archived'));
});
test('one row per case, sorted by case ID', () => {
  const cases = [
    aCase({ id: '2', displayId: 'Z.Z-1', initials: 'Z.Z', caseNumber: '1', entries: [entry('2026-11-16', 30)] }),
    aCase({ id: '3', displayId: 'A.A-1', initials: 'A.A', caseNumber: '1', entries: [entry('2026-11-16', 30), entry('2026-11-17', 30)] }),
  ];
  assert.deepEqual(dataRows(buildCsv(cases, WEEK)).map(r => r.split(',')[0]), ['A.A-1', 'Z.Z-1']);
});
test('an entry note goes in brackets after its time, on one line, and is escaped', () => {
  const c = aCase({ entries: [entry('2026-11-16', 30, { note: 'said "hi"\nthen left' })] });
  const [row] = dataRows(buildCsv([c], WEEK));
  assert.ok(row.includes('"Nov 16, 2026: 30 min (said ""hi"" then left)"'), row);
});
test('case notes are kept and escaped; formula-looking notes are neutralised', () => {
  const c = aCase({ notes: 'blocked: waiting on consent,\nparent away', entries: [entry('2026-11-16', 30)] });
  assert.ok(buildCsv([c], WEEK).endsWith(',"blocked: waiting on consent,\nparent away"\r\n'));
  const f = aCase({ notes: '=HYPERLINK("x")', entries: [entry('2026-11-16', 30)] });
  assert.ok(buildCsv([f], WEEK).includes(`"'=HYPERLINK(""x"")"`));
});
test('leading-zero case numbers and a missing due date come through as written', () => {
  const c = aCase({ displayId: 'A.S-00122', initials: 'A.S', caseNumber: '00122', dueDate: null, entries: [entry('2026-11-16', 5)] });
  assert.equal(dataRows(buildCsv([c], WEEK))[0], 'A.S,00122,5 minutes,0.08,"Nov 16, 2026: 5 min",,');
});
test('rangeSummary counts the cases and entries that the export will contain', () => {
  const cases = [
    aCase({ entries: [entry('2026-11-16', 30), entry('2026-11-17', 30), entry('2026-12-01', 30)] }),
    aCase({ id: '2', displayId: 'B-1', entries: [entry('2026-11-16', 30)] }),
    aCase({ id: '3', displayId: 'C-1', entries: [entry('2026-01-01', 30)] }),
  ];
  assert.deepEqual(rangeSummary(cases, WEEK), { cases: 2, entries: 3 });
  assert.deepEqual(rangeSummary(cases, null), { cases: 3, entries: 5 });
  assert.deepEqual(rangeSummary([], WEEK), { cases: 0, entries: 0 });
});
test('exportFilename', () => {
  assert.equal(exportFilename('week', '2026-11-15'), 'caseload-week-2026-11-15.csv');
  assert.equal(exportFilename('schoolyear', '2026-07-01'), 'caseload-schoolyear-2026-07-01.csv');
});
