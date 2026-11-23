import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { backupDue, shouldWarnNotInstalled } from '../js/reminders.js';

const aCase = (over = {}) => ({ id: 'c1', createdAt: 1, ...over });

test('shouldWarnNotInstalled only for iOS, in a browser tab, with data', () => {
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: false, caseCount: 3 }), true);
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: true, caseCount: 3 }), false);
  assert.equal(shouldWarnNotInstalled({ isIOS: false, isStandalone: false, caseCount: 3 }), false);
  assert.equal(shouldWarnNotInstalled({ isIOS: true, isStandalone: false, caseCount: 0 }), false);
});
test('backupDue: after 14 days since last backup, or since the oldest case if never backed up', () => {
  const DAY = 86_400_000;
  const now = 100 * DAY;
  assert.equal(backupDue({ lastBackupMs: now - 13 * DAY, cases: [aCase()], nowMs: now }), false);
  assert.equal(backupDue({ lastBackupMs: now - 14 * DAY, cases: [aCase()], nowMs: now }), true);
  assert.equal(backupDue({ lastBackupMs: null, cases: [aCase({ createdAt: now - DAY })], nowMs: now }), false);
  assert.equal(backupDue({ lastBackupMs: null, cases: [aCase({ createdAt: now - 20 * DAY })], nowMs: now }), true);
  assert.equal(backupDue({ lastBackupMs: null, cases: [], nowMs: now }), false);
});
