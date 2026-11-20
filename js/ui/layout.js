// Page chrome shared by every view: top bar plus any banners that apply right now.
import { h } from './dom.js';
import { routes } from './router.js';

function banners(ctx) {
  const items = [];
  if (ctx.state.error) {
    items.push(h('div', { class: 'banner error', role: 'alert' },
      h('span', {}, ctx.state.error),
      h('button', { type: 'button', class: 'banner-btn', onClick: () => { ctx.state.error = null; ctx.rerender(); } }, 'Dismiss')));
  }
  if (ctx.state.update) {
    items.push(h('div', { class: 'banner update', role: 'status' },
      h('span', {}, 'A new version is ready.'),
      h('button', { type: 'button', class: 'banner-btn', onClick: () => ctx.state.update.apply() }, 'Update')));
  }
  const timer = ctx.store.getMeta('timer');
  const timed = timer && ctx.store.getCase(timer.caseId);
  if (timed) {
    items.push(h('div', { class: 'banner timer' },
      h('span', {}, `Timer running for ${timed.displayId}`),
      h('a', { class: 'banner-btn', href: routes.caseDetail(timed.id) }, 'Open')));
  }
  return items;
}

/** actions: [{ label, href }] shown top-right. back: { label, href }. */
export function page(ctx, { title, back, actions = [] }, ...content) {
  return h('main', { class: 'page' },
    h('header', { class: 'topbar' },
      back && h('a', { class: 'back', href: back.href }, `‹ ${back.label}`),
      h('div', { class: 'title-row' },
        h('h1', {}, title),
        h('nav', { class: 'top-actions', 'aria-label': 'Sections' },
          actions.map(a => h('a', { class: 'link-btn', href: a.href }, a.label))))),
    banners(ctx),
    ...content);
}
