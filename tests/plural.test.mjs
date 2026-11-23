import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { plural } from '../js/plural.js';

test('plural: counts with the right word form', () => {
  assert.equal(plural(1, 'case'), '1 case');
  assert.equal(plural(0, 'case'), '0 cases');
  assert.equal(plural(2, 'minute'), '2 minutes');
});
test('plural: irregular plurals are given explicitly', () => {
  assert.equal(plural(1, 'entry', 'entries'), '1 entry');
  assert.equal(plural(3, 'entry', 'entries'), '3 entries');
});
