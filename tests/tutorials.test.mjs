import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { TOPICS, topicById, shouldShow, markSeen } from '../js/tutorials.js';

test('every topic has a unique id, a title, and steps with a heading and body', () => {
  assert.deepEqual(TOPICS.map(t => t.id), ['welcome', 'addCase', 'logTime', 'archive', 'calendar', 'exportBackup']);
  assert.equal(new Set(TOPICS.map(t => t.id)).size, TOPICS.length);
  for (const t of TOPICS) {
    assert.ok(t.title.length > 0, `${t.id} needs a title`);
    assert.ok(t.steps.length >= 1, `${t.id} needs steps`);
    for (const s of t.steps) {
      assert.ok(s.heading.length > 0 && s.body.length > 0, `${t.id} has an empty step`);
    }
  }
});
test('the Welcome tutorial tells her to install first and use only the installed icon', () => {
  const text = topicById('welcome').steps.map(s => `${s.heading} ${s.body}`).join(' ');
  assert.match(text, /Add to Home Screen/);
  assert.match(text, /separate/i);
});
test('the Welcome tutorial states the initials-only privacy rule', () => {
  const text = topicById('welcome').steps.map(s => `${s.heading} ${s.body}`).join(' ');
  assert.match(text, /full name/i);
});
test('topicById finds topics and returns undefined for unknown ids', () => {
  assert.equal(topicById('calendar').id, 'calendar');
  assert.equal(topicById('nope'), undefined);
});
test('shouldShow is true until a topic is marked seen', () => {
  assert.equal(shouldShow('welcome', undefined), true);
  assert.equal(shouldShow('welcome', {}), true);
  assert.equal(shouldShow('welcome', { welcome: true }), false);
  assert.equal(shouldShow('calendar', { welcome: true }), true);
});
test('markSeen adds a flag without mutating the old map', () => {
  const before = { welcome: true };
  const after = markSeen(before, 'calendar');
  assert.deepEqual(after, { welcome: true, calendar: true });
  assert.deepEqual(before, { welcome: true });
  assert.deepEqual(markSeen(undefined, 'welcome'), { welcome: true });
});
