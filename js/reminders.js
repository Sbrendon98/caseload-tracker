// When to nudge her about her data: back up regularly, and use the installed app, not a browser tab.

const BACKUP_NUDGE_DAYS = 14;
const DAY_MS = 86_400_000;

/** iOS home-screen apps have storage separate from Safari tabs; warn when data sits in a tab. */
export function shouldWarnNotInstalled({ isIOS, isStandalone, caseCount }) {
  return Boolean(isIOS) && !isStandalone && caseCount > 0;
}

/** True after 14 days without a backup (counted from the oldest case if she never backed up). */
export function backupDue({ lastBackupMs, cases, nowMs, days = BACKUP_NUDGE_DAYS }) {
  if (cases.length === 0) return false;
  const baseline = lastBackupMs ?? Math.min(...cases.map(c => c.createdAt));
  return nowMs - baseline >= days * DAY_MS;
}
