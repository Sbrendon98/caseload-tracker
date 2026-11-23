// Pure grouping of time entries by calendar day. Archived cases are included. Times are in seconds,
// so a timer entry shorter than a minute still counts.
import { entrySeconds } from './durations.js';

function relevant(cases, caseId) {
  return caseId ? cases.filter(c => c.id === caseId) : cases;
}

/** Map of 'YYYY-MM-DD' -> total seconds that day. caseId narrows to one case. */
export function entriesByDay(cases, { caseId = null } = {}) {
  const days = new Map();
  for (const c of relevant(cases, caseId)) {
    for (const e of c.entries) days.set(e.date, (days.get(e.date) ?? 0) + entrySeconds(e));
  }
  return days;
}

/** Every case worked on `date`, once each, sorted by displayId, with the day total. */
export function casesForDay(cases, date, { caseId = null } = {}) {
  const items = [];
  for (const c of relevant(cases, caseId)) {
    const seconds = c.entries.filter(e => e.date === date).reduce((sum, e) => sum + entrySeconds(e), 0);
    if (seconds > 0) items.push({ caseId: c.id, displayId: c.displayId, seconds, archived: c.archived });
  }
  items.sort((a, b) => a.displayId.localeCompare(b.displayId));
  return { total: items.reduce((sum, i) => sum + i.seconds, 0), items };
}

/** Move a { year, month (1-12) } by whole months, rolling the year as needed. */
export function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}
