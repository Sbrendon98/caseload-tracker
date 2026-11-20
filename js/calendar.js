// Pure grouping of time entries by calendar day. Archived cases are included.

function relevant(cases, caseId) {
  return caseId ? cases.filter(c => c.id === caseId) : cases;
}

/** Map of 'YYYY-MM-DD' -> total minutes that day. caseId narrows to one case. */
export function entriesByDay(cases, { caseId = null } = {}) {
  const days = new Map();
  for (const c of relevant(cases, caseId)) {
    for (const e of c.entries) days.set(e.date, (days.get(e.date) ?? 0) + e.minutes);
  }
  return days;
}

/** Every case worked on `date`, once each, sorted by displayId, with the day total. */
export function casesForDay(cases, date, { caseId = null } = {}) {
  const items = [];
  for (const c of relevant(cases, caseId)) {
    const minutes = c.entries.filter(e => e.date === date).reduce((sum, e) => sum + e.minutes, 0);
    if (minutes > 0) items.push({ caseId: c.id, displayId: c.displayId, minutes, archived: c.archived });
  }
  items.sort((a, b) => a.displayId.localeCompare(b.displayId));
  return { total: items.reduce((sum, i) => sum + i.minutes, 0), items };
}
