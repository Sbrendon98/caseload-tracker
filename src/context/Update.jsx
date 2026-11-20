// "A new version is ready". Registers the service worker once for the whole app; a new version
// waits until she taps Update, so a screen is never swapped mid-entry.
import { createContext } from 'preact';
import { useContext, useMemo } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';

const UpdateContext = createContext({ needRefresh: false, apply: () => {} });

export const useUpdate = () => useContext(UpdateContext);

export function UpdateProvider({ children }) {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a newer version whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration?.update().catch(() => {});
      });
    },
    onRegisterError(e) { console.warn('Offline support could not start', e); },
  });
  const value = useMemo(() => ({ needRefresh, apply: () => updateServiceWorker(true) }), [needRefresh, updateServiceWorker]);
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}
