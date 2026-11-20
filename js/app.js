// Bootstrap: open storage, load the data, wire the router, render.
import { openDb, StorageError } from './db.js';
import { createStore } from './store.js';
import { todayLocal } from './dates.js';
import { h } from './ui/dom.js';
import { parseHash, routes } from './ui/router.js';
import { listView } from './ui/views/list.js';
import { archivedView } from './ui/views/archived.js';
import { detailView } from './ui/views/detail.js';
import { calendarView } from './ui/views/calendar.js';
import { optionsView } from './ui/views/options.js';

const views = { list: listView, archived: archivedView, case: detailView, calendar: calendarView, options: optionsView };

function fatalScreen(error) {
  const message = error instanceof StorageError ? error.message : 'Something went wrong while starting the app.';
  return h('main', { class: 'page' },
    h('h1', {}, 'Cannot open your data'),
    h('p', { class: 'form-error', role: 'alert' }, message),
    h('p', {}, 'Nothing has been changed or deleted. Close the app and open it again. If this keeps happening, check that you are not in Private Browsing and that your phone has free storage.'),
    h('button', { type: 'button', class: 'btn primary', onClick: () => location.reload() }, 'Try again'));
}

/** Ask the browser not to evict our data. Only asked once; failure is not fatal. */
async function requestPersistence(store) {
  if (store.getMeta('persistRequested')) return;
  try {
    const granted = await navigator.storage?.persist?.();
    await store.setMeta('persistRequested', true);
    await store.setMeta('persistGranted', Boolean(granted));
  } catch (e) {
    console.warn('Persistent storage request failed', e);
  }
}

async function boot() {
  const root = document.getElementById('app');
  let store;
  try {
    store = createStore(await openDb());
    await store.load();
  } catch (e) {
    root.replaceChildren(fatalScreen(e));
    return;
  }

  let current = null;
  const ctx = {
    store,
    state: { search: '', error: null },
    today: () => todayLocal(),
    now: () => Date.now(),
    navigate: hash => { location.hash = hash; },
    rerender: () => render({ keepScroll: true }),
    /** Show a message in the red banner at the top of every screen. */
    fail(message) { ctx.state.error = message; ctx.rerender(); },
    /** Await a store call; a StorageError becomes a visible banner and the result is null. */
    async guard(promise) {
      try { return await promise; }
      catch (e) {
        if (!(e instanceof StorageError)) throw e;
        ctx.fail(e.message);
        return null;
      }
    },
  };

  function render({ keepScroll = false } = {}) {
    const y = keepScroll ? window.scrollY : 0;
    current?.destroy?.();
    const route = parseHash(location.hash);
    current = (views[route.name] ?? views.list)(ctx, route);
    root.replaceChildren(current.el);
    window.scrollTo(0, y);
  }

  store.subscribe(() => render({ keepScroll: true }));
  window.addEventListener('hashchange', () => render());
  window.addEventListener('unhandledrejection', e => {
    ctx.fail(`Something unexpected went wrong: ${e.reason?.message ?? e.reason}`);
  });

  if (!location.hash) history.replaceState(null, '', routes.list());
  render();
  requestPersistence(store);
}

boot();
