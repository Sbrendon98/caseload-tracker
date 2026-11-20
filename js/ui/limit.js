// The "Archive completed cases" sheet. Opened whenever an action would put her over 50 active
// cases (new case, unarchive, or after a restore that brought in more than 50). Once there is
// room, the pending action is retried automatically so she never re-enters anything.
import { h } from './dom.js';
import { openModal } from './modal.js';
import { swipeRow } from './swipeRow.js';
import { formatDateShort } from './format.js';
import { ACTIVE_LIMIT, activeCount, canAddActive, formatDuration, totalMinutes } from '../model.js';
import { todayLocal } from '../dates.js';

/** Resolves with retry()'s result once there is room, or null if she closed the sheet first. */
export function limitFlow(ctx, { retry }) {
  return new Promise(resolve => {
    let settled = false;
    const status = h('p', { class: 'limit-status', role: 'status' });
    const list = h('ul', { class: 'case-list' });
    const modal = openModal({
      title: 'Archive completed cases',
      onClose: () => { if (!settled) resolve(null); },
      content: h('div', {},
        h('p', {}, `You can have up to ${ACTIVE_LIMIT} active cases. Archive the ones you have finished to make room. Oldest cases are listed first. Swipe a case left and tap Archive, or use its Archive button.`),
        status, list),
    });

    async function archive(c) {
      const r = await ctx.guard(ctx.store.archive(c.id));
      if (!r) return;
      if (canAddActive(ctx.store.cases())) {
        settled = true;
        const result = await ctx.guard(retry());
        modal.close();
        resolve(result);
      } else {
        draw();
      }
    }

    function draw() {
      const active = ctx.store.activeOldestFirst();
      const need = activeCount(ctx.store.cases()) - (ACTIVE_LIMIT - 1);
      status.textContent = `You have ${active.length} active cases. Archive ${need} more to continue.`;
      list.replaceChildren(...active.map(c => swipeRow({
        menuMode: 'button',
        menuLabel: `Archive ${c.displayId}`,
        onAction: () => archive(c),
        content: h('div', { class: 'case-link' },
          h('span', { class: 'case-id' }, c.displayId),
          h('span', { class: 'case-meta' }, `Added ${formatDateShort(todayLocal(new Date(c.createdAt)))}`),
          h('span', { class: 'case-total' }, formatDuration(totalMinutes(c.entries)))),
      })));
    }
    draw();
  });
}
