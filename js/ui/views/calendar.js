// Month calendar: a dot on every day any work was logged. Tap a day to see every case worked
// that day. Optionally narrowed to one case (the detail screen deep-links here with ?case=).
import { showTutorialOnce } from '../tutorials.js';
import { h } from '../dom.js';
import { page } from '../layout.js';
import { routes } from '../router.js';
import { openModal } from '../modal.js';
import { formatDateLong, formatMonth } from '../format.js';
import { casesForDay, entriesByDay, shiftMonth } from '../../calendar.js';
import { dayOfWeek, monthGrid, parseISO } from '../../dates.js';
import { formatDuration } from '../../model.js';

function startingMonth(ctx, dateParam) {
  try {
    const { y, m } = parseISO(dateParam || ctx.today());
    return { year: y, month: m };
  } catch {
    const { y, m } = parseISO(ctx.today());
    return { year: y, month: m };
  }
}

const level = minutes => (minutes >= 180 ? 3 : minutes >= 60 ? 2 : 1);

export function calendarView(ctx, route) {
  const { store } = ctx;
  const weekStart = store.getMeta('weekStart', 0);
  const today = ctx.today();
  let shown = startingMonth(ctx, route.query.date);
  let caseId = store.getCase(route.query.case) ? route.query.case : '';

  const title = h('h2', { class: 'cal-title', 'aria-live': 'polite' });
  const grid = h('div', { class: 'cal-grid' });

  function openDay(date) {
    const { total, items } = casesForDay(store.cases(), date, { caseId: caseId || null });
    const modal = openModal({
      title: formatDateLong(date),
      content: h('div', {},
        items.length === 0
          ? h('p', { class: 'muted' }, 'No time logged this day.')
          : [
            h('p', { class: 'total-label' }, 'Total for the day'),
            h('p', { class: 'total' }, formatDuration(total)),
            h('ul', { class: 'case-list' }, items.map(i => h('li', { class: 'plain-row' },
              h('a', {
                class: 'case-link', href: routes.caseDetail(i.caseId),
                onClick: () => modal.close(),
              },
              h('span', { class: 'case-id' }, i.displayId),
              h('span', { class: 'case-meta' }, i.archived ? 'Archived' : 'Active'),
              h('span', { class: 'case-total' }, formatDuration(i.minutes)))))),
          ]),
    });
  }

  function cell({ date, inMonth }, minutes) {
    const weekday = dayOfWeek(date);
    const classes = ['cal-cell', !inMonth && 'out', (weekday === 0 || weekday === 6) && 'weekend', date === today && 'today'];
    return h('button', {
      type: 'button', class: classes.filter(Boolean).join(' '), disabled: !inMonth,
      'aria-label': minutes > 0 ? `${formatDateLong(date)}, ${formatDuration(minutes)} logged` : formatDateLong(date),
      onClick: () => openDay(date),
    },
    h('span', { class: 'num' }, String(parseISO(date).d)),
    minutes > 0 && h('span', { class: `dot lvl${level(minutes)}`, 'aria-hidden': 'true' }));
  }

  function draw() {
    const byDay = entriesByDay(store.cases(), { caseId: caseId || null });
    const weeks = monthGrid(shown.year, shown.month, weekStart);
    title.textContent = formatMonth(shown.year, shown.month);
    grid.replaceChildren(
      h('div', { class: 'cal-row cal-head', 'aria-hidden': 'true' },
        weeks[0].map(({ date }) => h('span', {}, (() => {
          const { y, m, d } = parseISO(date);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' });
        })()))),
      ...weeks.map(week => h('div', { class: 'cal-row' }, week.map(day => cell(day, byDay.get(day.date) ?? 0)))));
  }

  const move = delta => { shown = shiftMonth(shown, delta); draw(); };
  const filter = h('select', {
    'aria-label': 'Show time for',
    onChange: e => { caseId = e.target.value; draw(); },
  },
  h('option', { value: '' }, 'All cases'),
  [...store.cases()].sort((a, b) => a.displayId.localeCompare(b.displayId)).map(c =>
    h('option', { value: c.id, selected: c.id === caseId }, c.archived ? `${c.displayId} (archived)` : c.displayId)));

  draw();
  const el = page(ctx, { title: 'Calendar', back: { label: 'Cases', href: routes.list() } },
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Show'), filter),
    h('div', { class: 'cal-nav' },
      h('button', { type: 'button', class: 'btn', 'aria-label': 'Previous month', onClick: () => move(-1) }, '‹'),
      title,
      h('button', { type: 'button', class: 'btn', 'aria-label': 'Next month', onClick: () => move(1) }, '›')),
    grid,
    h('p', { class: 'muted cal-hint' }, 'A dot marks a day with time logged. Tap a day to see which cases you worked on.'));
  showTutorialOnce(ctx, 'calendar');
  return { el };
}
