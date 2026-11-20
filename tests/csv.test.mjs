import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { BOM, HEADERS, escapeField, buildCsv, exportFilename } from '../js/csv.js';

const aCase = (over = {}) => ({
  id: '1', displayId: 'A.S-122', initials: 'A.S', caseNumber: '122',
  dueDate: '2026-12-01', archived: false, notes: '', entries: [], ...over,
});
const entry = (over = {}) => ({ id: 'e', date: '2026-11-17', minutes: 90, note: '', createdAt: 1, ...over });
const dataRows = csv => csv.slice(1).split('\r\n').slice(1, -1);

test('HEADERS match the agreed column order, Case Notes last', () => {
  assert.deepEqual(HEADERS, [
    'Case ID', 'Initials', 'Case Number', 'Entry Date', 'Hours', 'Minutes', 'Total Minutes',
    'Decimal Hours', 'Note', 'Case Due Date', 'Archived', 'Case Notes',
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
test('buildCsv: BOM, header, and one correctly escaped row incl. case notes', () => {
  const c = aCase({ notes: 'blocked: waiting on consent,\nparent away', entries: [entry({ note: 'said "hi", ok' })] });
  const csv = buildCsv([c], null);
  assert.ok(csv.startsWith(BOM));
  assert.equal(csv.slice(1).split('\r\n')[0], HEADERS.join(','));
  assert.equal(
    csv.slice(1).split('\r\n').slice(1).join('\r\n'),
    'A.S-122,A.S,122,2026-11-17,1,30,90,1.50,"said ""hi"", ok",2026-12-01,No,"blocked: waiting on consent,\nparent away"\r\n',
  );
});
test('buildCsv filters by entry date inclusively and includes archived cases', () => {
  const cases = [
    aCase({ entries: [entry({ date: '2026-11-14' }), entry({ date: '2026-11-15' }), entry({ date: '2026-11-21' }), entry({ date: '2026-11-22' })] }),
    aCase({ id: '2', displayId: 'B.C-9', initials: 'B.C', caseNumber: '9', archived: true, dueDate: null, entries: [entry({ date: '2026-11-16' })] }),
  ];
  const rows = dataRows(buildCsv(cases, { start: '2026-11-15', end: '2026-11-21' }));
  assert.equal(rows.length, 3);
  assert.ok(rows.includes('B.C-9,B.C,9,2026-11-16,1,30,90,1.50,,,Yes,'));
});
test('buildCsv: no entries still yields a header-only file', () => {
  assert.equal(buildCsv([aCase()], null), BOM + HEADERS.join(',') + '\r\n');
});
test('buildCsv sorts by date, then case id', () => {
  const cases = [
    aCase({ displayId: 'Z.Z-1', entries: [entry({ date: '2026-11-17' })] }),
    aCase({ id: '2', displayId: 'A.A-1', entries: [entry({ date: '2026-11-17' }), entry({ date: '2026-11-16' })] }),
  ];
  const order = dataRows(buildCsv(cases, null)).map(r => r.split(',')[0] + '@' + r.split(',')[3]);
  assert.deepEqual(order, ['A.A-1@2026-11-16', 'A.A-1@2026-11-17', 'Z.Z-1@2026-11-17']);
});
test('buildCsv keeps leading-zero case numbers as written', () => {
  const c = aCase({ displayId: 'A.S-00122', caseNumber: '00122', entries: [entry()] });
  assert.ok(dataRows(buildCsv([c], null))[0].startsWith('A.S-00122,A.S,00122,'));
});
test('exportFilename', () => {
  assert.equal(exportFilename('week', '2026-11-15'), 'caseload-week-2026-11-15.csv');
  assert.equal(exportFilename('schoolyear', '2026-07-01'), 'caseload-schoolyear-2026-07-01.csv');
});
