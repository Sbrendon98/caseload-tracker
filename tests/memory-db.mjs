// In-memory stand-in for js/db.js's adapter, used only by tests. Mimics what IndexedDB
// gives us: structured-clone isolation, atomic writes, and a unique displayIdKey index.
import { StorageError } from '../js/db.js';
import { displayIdKey } from '../js/model.js';

const clone = v => JSON.parse(JSON.stringify(v));
const tombKey = t => `${t.type}:${t.id}`;

export function createMemoryDb() {
  let cases = new Map();
  let tombstones = new Map();
  let meta = new Map();
  let failure = null;

  const check = () => {
    if (!failure) return;
    const message = failure;
    failure = null;
    throw new StorageError(message);
  };
  const assertUnique = map => {
    const keys = new Set();
    for (const c of map.values()) {
      const k = displayIdKey(c.displayId);
      if (keys.has(k)) throw new StorageError(`Duplicate case ID ${c.displayId}.`);
      keys.add(k);
    }
  };

  return {
    /** The next write rejects with a StorageError, then the db recovers. */
    failNext(message = 'disk full') { failure = message; },

    async getAll() {
      check();
      return { cases: clone([...cases.values()]), tombstones: clone([...tombstones.values()]), meta: clone(Object.fromEntries(meta)) };
    },

    async apply({ putCases = [], deleteCaseIds = [], putTombstones = [] }) {
      check();
      const nextCases = new Map(cases);
      for (const id of deleteCaseIds) nextCases.delete(id);
      for (const c of putCases) nextCases.set(c.id, clone(c));
      assertUnique(nextCases);
      const nextTombs = new Map(tombstones);
      for (const t of putTombstones) nextTombs.set(tombKey(t), clone(t));
      cases = nextCases;
      tombstones = nextTombs;
    },

    async replaceAll({ cases: newCases, tombstones: newTombs }) {
      check();
      const nextCases = new Map(newCases.map(c => [c.id, clone(c)]));
      assertUnique(nextCases);
      cases = nextCases;
      tombstones = new Map(newTombs.map(t => [tombKey(t), clone(t)]));
    },

    async setMeta(key, value) {
      check();
      if (value === undefined) meta.delete(key);
      else meta.set(key, clone(value));
    },
  };
}
