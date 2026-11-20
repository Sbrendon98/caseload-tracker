// Current hash route, kept in sync with the address bar. Parsing lives in js/router.js (unit tested).
import { useMemo } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { parseHash } from '../../js/router.js';

const subscribe = callback => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(hash) {
  window.location.hash = hash;
}
