// Month calendar: a dot on every day any work was logged. Tap a day to see every case worked
// that day. Optionally narrowed to one case (the case page deep-links here with ?case=).
import { useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { Sheet, useDialogs } from '../context/Dialogs.jsx';
import { Page } from '../components/Page.jsx';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { formatDateLong, formatMonth } from '../../js/format.js';
import { casesForDay, entriesByDay, shiftMonth } from '../../js/calendar.js';
import { dayOfWeek, monthGrid, parseISO } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { formatDuration } from '../../js/model.js';

const level = minutes => (minutes >= 180 ? 3 : minutes >= 60 ? 2 : 1);

function startingMonth(today, dateParam) {
  try {
    const { y, m } = parseISO(dateParam || today);
    return { year: y, month: m };
  } catch {
    const { y, m } = parseISO(today);
    return { year: y, month: m };
  }
}

function weekdayLetter(iso) {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' });
}

function DaySheet({ date, caseId, onClose }) {
  const { store } = useApp();
  const { total, items } = casesForDay(store.cases(), date, { caseId: caseId || null });
  return (
    <Sheet title={formatDateLong(date)} onClose={onClose}>
      {({ dismiss }) => (
        <div>
          {items.length === 0
            ? <p class="muted">No time logged this day.</p>
            : (
              <>
                <p class="total-label">Total for the day</p>
                <p class="total">{formatDuration(total)}</p>
                <ul class="case-list">
                  {items.map(i => (
                    <li key={i.caseId} class="plain-row">
                      <a class="case-link" href={routes.caseDetail(i.caseId)} onClick={dismiss}>
                        <span class="case-id">{i.displayId}</span>
                        <span class="case-meta">{i.archived ? 'Archived' : 'Active'}</span>
                        <span class="case-total">{formatDuration(i.minutes)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
        </div>
      )}
    </Sheet>
  );
}

export function CalendarPage({ query }) {
  const { store, today } = useApp();
  const dialogs = useDialogs();
  const [shown, setShown] = useState(() => startingMonth(today(), query.date));
  const [caseId, setCaseId] = useState(() => (store.getCase(query.case) ? query.case : ''));
  useTutorial('calendar');

  const weekStart = store.getMeta('weekStart', 0);
  const byDay = entriesByDay(store.cases(), { caseId: caseId || null });
  const weeks = monthGrid(shown.year, shown.month, weekStart);
  const todayIso = today();
  const cases = [...store.cases()].sort((a, b) => a.displayId.localeCompare(b.displayId));

  const openDay = date => dialogs.open(({ close }) => <DaySheet date={date} caseId={caseId} onClose={close} />);

  return (
    <Page title="Calendar" back={{ label: 'Cases', href: routes.list() }}>
      <label class="field">
        <span class="label">Show</span>
        <select aria-label="Show time for" value={caseId} onChange={e => setCaseId(e.currentTarget.value)}>
          <option value="">All cases</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.archived ? `${c.displayId} (archived)` : c.displayId}</option>)}
        </select>
      </label>
      <div class="cal-nav">
        <button type="button" class="btn" aria-label="Previous month" onClick={() => setShown(shiftMonth(shown, -1))}>‹</button>
        <h2 class="cal-title" aria-live="polite">{formatMonth(shown.year, shown.month)}</h2>
        <button type="button" class="btn" aria-label="Next month" onClick={() => setShown(shiftMonth(shown, 1))}>›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-row cal-head" aria-hidden="true">
          {weeks[0].map(({ date }) => <span key={date}>{weekdayLetter(date)}</span>)}
        </div>
        {weeks.map(week => (
          <div key={week[0].date} class="cal-row">
            {week.map(({ date, inMonth }) => {
              const minutes = byDay.get(date) ?? 0;
              const weekday = dayOfWeek(date);
              const classes = ['cal-cell', !inMonth && 'out', (weekday === 0 || weekday === 6) && 'weekend', date === todayIso && 'today'];
              return (
                <button
                  key={date} type="button" class={classes.filter(Boolean).join(' ')} disabled={!inMonth}
                  aria-label={minutes > 0 ? `${formatDateLong(date)}, ${formatDuration(minutes)} logged` : formatDateLong(date)}
                  onClick={() => openDay(date)}
                >
                  <span class="num">{parseISO(date).d}</span>
                  {minutes > 0 && <span class={`dot lvl${level(minutes)}`} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p class="muted cal-hint">A dot marks a day with time logged. Tap a day to see which cases you worked on.</p>
    </Page>
  );
}
