// Main screen: active cases, newest first, with search, this-week total and a New case button.
import { h } from '../dom.js';
import { page } from '../layout.js';
import { routes } from '../router.js';
import { swipeRow } from '../swipeRow.js';
import { archiveWithUndo, openCaseMenu, openNewCase } from '../caseActions.js';
import { formatDateShort } from '../format.js';
import { weekRange, inRange } from '../../dates.js';
import { ACTIVE_LIMIT, dueStatus, formatDuration, matchesSearch, totalMinutes } from '../../model.js';

function caseRowContent(ctx, c) {
  const status = dueStatus(c.dueDate, ctx.today());
  return h('a', { class: 'case-link', href: routes.caseDetail(c.id) },
    h('span', { class: 'case-id' }, c.displayId),
    h('span', { class: 'case-meta' },
      c.dueDate ? `Due ${formatDateShort(c.dueDate)}` : 'No due date',
      status && h('span', { class: `badge ${status}` }, status === 'overdue' ? 'Overdue' : 'Due soon')),
    h('span', { class: 'case-total' }, formatDuration(totalMinutes(c.entries))));
}

export function listView(ctx) {
  const { store } = ctx;
  const week = weekRange(ctx.today(), store.getMeta('weekStart', 0));
  const weekEntries = store.cases().flatMap(c => c.entries).filter(e => inRange(e.date, week));
  const activeTotal = store.activeNewestFirst().length;
  const archivedCount = store.cases().length - activeTotal;

  const list = h('ul', { class: 'case-list' });
  const empty = h('p', { class: 'empty' });

  function drawRows() {
    const query = ctx.state.search;
    const shown = store.activeNewestFirst().filter(c => matchesSearch(c.displayId, query));
    list.replaceChildren(...shown.map(c => swipeRow({
      content: caseRowContent(ctx, c),
      onAction: () => archiveWithUndo(ctx, c),
      menuLabel: `More actions for ${c.displayId}`,
      onMenu: () => openCaseMenu(ctx, c),
    })));
    empty.textContent = activeTotal === 0
      ? 'No cases yet. Tap “+ New case” to add your first one.'
      : shown.length === 0 ? 'No cases match your search.' : '';
    empty.hidden = !empty.textContent;
  }

  const search = h('input', {
    type: 'search', class: 'search', placeholder: 'Search by ID, e.g. A.S-122', value: ctx.state.search,
    'aria-label': 'Search cases by ID', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: false,
    onInput: e => { ctx.state.search = e.target.value; drawRows(); },
  });
  drawRows();

  const el = page(ctx, { title: 'Caseload', actions: [{ label: 'Calendar', href: routes.calendar() }, { label: 'Options', href: routes.options() }] },
    h('p', { class: 'summary' },
      h('span', {}, `This week: ${formatDuration(totalMinutes(weekEntries))}`),
      h('span', {}, `${activeTotal} of ${ACTIVE_LIMIT} active`)),
    search, list, empty,
    h('p', { class: 'footer-link' }, h('a', { href: routes.archived() }, `Archived cases (${archivedCount})`)),
    h('div', { class: 'bottom-bar' },
      h('button', { type: 'button', class: 'btn primary block', onClick: () => openNewCase(ctx) }, '+ New case')));
  return { el };
}
