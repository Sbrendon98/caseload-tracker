// Everything screens share: the data store, the current clock, the error banner, and a few
// "just for this session" flags. Components re-render when the store changes (including settings).
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { StorageError } from '../../js/db.js';
import { todayLocal } from '../../js/dates.js';

const AppContext = createContext(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

export function AppProvider({ store, now = Date.now, children }) {
  // Re-render everything that reads the store whenever it announces a change.
  const version = useSyncExternalStore(store.subscribe, store.version);

  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState({ hideInstallWarning: false, hideBackupNudge: false });
  const tutorialsShown = useRef(new Set());

  /** Await a store call; a StorageError becomes the red banner and the result is null. */
  const guard = useCallback(async promise => {
    try { return await promise; }
    catch (e) {
      if (!(e instanceof StorageError)) throw e;
      setError(e.message);
      return null;
    }
  }, []);

  useEffect(() => {
    const onRejection = e => setError(`Something unexpected went wrong: ${e.reason?.message ?? e.reason}`);
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  const value = useMemo(() => ({
    store,
    version,
    now,
    today: () => todayLocal(new Date(now())),
    error, setError, fail: setError,
    guard,
    search, setSearch,
    session, hideForSession: key => setSession(s => ({ ...s, [key]: true })),
    tutorialsShown: tutorialsShown.current,
  }), [store, version, now, error, guard, search, session]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
