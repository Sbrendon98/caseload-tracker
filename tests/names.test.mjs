import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { parseName } from '../js/names.js';

test('parseName: initials in any format become dotted capitals', () => {
  const ok = (raw, want) => assert.deepEqual(parseName(raw), { ok: true, value: want, error: null }, raw);
  ok('as', 'A.S');
  ok('A S', 'A.S');
  ok('a.s.', 'A.S');
  ok(' A. B. C ', 'A.B.C');
  ok('A B C D', 'A.B.C.D');
  ok('J.D', 'J.D');
  ok('é', 'É');
});
test('parseName: first name plus last initial, tidily capitalized', () => {
  const ok = (raw, want) => assert.deepEqual(parseName(raw), { ok: true, value: want, error: null }, raw);
  ok('Jane D.', 'Jane D.');
  ok('jane d', 'Jane D.');
  ok('JANE D', 'Jane D.');
  ok('Jane   d.', 'Jane D.');
  ok('mary-jane d', 'Mary-Jane D.');
  ok("o'neil d", "O'Neil D.");
  ok('Al D', 'Al D.');
});
test('parseName: short all-caps words are initials, not names', () => {
  assert.equal(parseName('AL D').value, 'A.L.D');
  assert.equal(parseName('AB C').value, 'A.B.C');
  assert.equal(parseName('JD').value, 'J.D');
});
test('parseName is stable: its own output parses to itself', () => {
  for (const v of ['A.S', 'A.B.C.D', 'Jane D.', 'Mary-Jane D.', "O'Neil D.", 'Al D.']) assert.equal(parseName(v).value, v, v);
});
test('parseName rejects a full last name, a lone first name, too many initials, and no letters', () => {
  for (const bad of ['Jane Doe', 'Jane Marie D', 'Jane', 'Anna', 'JaneDoe', 'JANE DOE', 'A B C D E', '123 -', '', null]) {
    const r = parseName(bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.value, '');
    assert.match(r.error, /first name and last initial/i);
  }
});
