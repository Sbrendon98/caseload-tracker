// IndexedDB adapter. The only module that touches indexedDB. Every failure is a StorageError
// with a message that is safe to show to the user. Not importable-for-effect: nothing runs on import.
import { displayIdKey } from './model.js';

const DB_NAME = 'caseload-tracker';
const DB_VERSION = 1;

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

const request = r => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const finished = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('The save was cancelled.'));
});

// The unique index needs the upper-cased ID on the stored row; it never leaks back out.
const toRow = c => ({ ...c, displayIdKey: displayIdKey(c.displayId) });
const fromRow = ({ displayIdKey: _key, ...c }) => c;
const toTombRow = t => ({ ...t, key: `${t.type}:${t.id}` });
const fromTombRow = ({ key: _key, ...t }) => t;

async function guarded(message, fn) {
  try { return await fn(); }
  catch (e) { throw e instanceof StorageError ? e : new StorageError(message, e); }
}

export async function openDb(factory = globalThis.indexedDB, name = DB_NAME) {
  if (!factory) {
    throw new StorageError('This browser cannot store data on this device (IndexedDB is unavailable).');
  }
  const db = await guarded(
    'Could not open the on-device database. Private browsing or very low storage can cause this.',
    () => new Promise((resolve, reject) => {
      const open = factory.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        const d = open.result;
        d.createObjectStore('cases', { keyPath: 'id' }).createIndex('displayIdKey', 'displayIdKey', { unique: true });
        d.createObjectStore('tombstones', { keyPath: 'key' });
        d.createObjectStore('meta', { keyPath: 'key' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Another open copy of the app is blocking an update.'));
    }));
  db.onversionchange = () => db.close();

  return {
    getAll: () => guarded('Could not read your saved data.', async () => {
      const tx = db.transaction(['cases', 'tombstones', 'meta'], 'readonly');
      const [cases, tombstones, metaRows] = await Promise.all([
        request(tx.objectStore('cases').getAll()),
        request(tx.objectStore('tombstones').getAll()),
        request(tx.objectStore('meta').getAll()),
      ]);
      return {
        cases: cases.map(fromRow),
        tombstones: tombstones.map(fromTombRow),
        meta: Object.fromEntries(metaRows.map(m => [m.key, m.value])),
      };
    }),

    /** One atomic write: all of it lands or none of it. */
    apply: ({ putCases = [], deleteCaseIds = [], putTombstones = [] }) =>
      guarded('Could not save your changes. Your storage may be full.', async () => {
        const tx = db.transaction(['cases', 'tombstones'], 'readwrite');
        const casesStore = tx.objectStore('cases');
        for (const id of deleteCaseIds) casesStore.delete(id);
        for (const c of putCases) casesStore.put(toRow(c));
        for (const t of putTombstones) tx.objectStore('tombstones').put(toTombRow(t));
        await finished(tx);
      }),

    replaceAll: ({ cases, tombstones }) =>
      guarded('Could not replace your data. Nothing was changed.', async () => {
        const tx = db.transaction(['cases', 'tombstones'], 'readwrite');
        const casesStore = tx.objectStore('cases');
        const tombStore = tx.objectStore('tombstones');
        casesStore.clear();
        tombStore.clear();
        for (const c of cases) casesStore.put(toRow(c));
        for (const t of tombstones) tombStore.put(toTombRow(t));
        await finished(tx);
      }),

    /** value === undefined deletes the key. */
    setMeta: (key, value) => guarded('Could not save a setting.', async () => {
      const tx = db.transaction('meta', 'readwrite');
      if (value === undefined) tx.objectStore('meta').delete(key);
      else tx.objectStore('meta').put({ key, value });
      await finished(tx);
    }),
  };
}
