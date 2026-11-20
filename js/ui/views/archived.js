// Archived cases, with Unarchive.
import { h } from '../dom.js';
import { page } from '../layout.js';
import { routes } from '../router.js';
import { unarchiveCase } from '../caseActions.js';
import { formatDateShort } from '../format.js';
import { todayLocal } from '../../dates.js';
import { formatDuration, totalMinutes } from '../../model.js';

export function archivedView(ctx) {
  const cases = ctx.store.archivedNewestFirst();
  const rows = cases.map(c => h('li', { class: 'plain-row' },
    h('a', { class: 'case-link', href: routes.caseDetail(c.id) },
      h('span', { class: 'case-id' }, c.displayId),
      h('span', { class: 'case-meta' }, `Archived ${formatDateShort(todayLocal(new Date(c.archivedAt)))}`),
      h('span', { class: 'case-total' }, formatDuration(totalMinutes(c.entries)))),
    h('button', {
      type: 'button', class: 'btn small', 'aria-label': `Unarchive ${c.displayId}`,
      onClick: () => unarchiveCase(ctx, c),
    }, 'Unarchive')));

  const el = page(ctx, { title: 'Archived', back: { label: 'Cases', href: routes.list() } },
    cases.length === 0
      ? h('p', { class: 'empty' }, 'No archived cases. Swipe a case left on the main list to archive it.')
      : h('ul', { class: 'case-list' }, rows));
  return { el };
}
