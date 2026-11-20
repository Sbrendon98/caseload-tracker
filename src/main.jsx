// Bootstrap: open storage, load the data, then render. If storage cannot open, say so plainly.
import { render } from 'preact';
import './styles.css';
import { openDb, StorageError } from '../js/db.js';
import { createStore } from '../js/store.js';
import { App } from './App.jsx';
import { FatalScreen } from './components/FatalScreen.jsx';

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
    render(<FatalScreen error={e} isStorageError={e instanceof StorageError} />, root);
    return;
  }
  if (!window.location.hash) history.replaceState(null, '', '#/');
  render(<App store={store} />, root);
  requestPersistence(store);
}

boot();
