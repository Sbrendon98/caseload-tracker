// Registers the service worker and tells the app when a newer version is waiting.

/** onUpdateReady(apply): apply() activates the waiting version; the page then reloads itself. */
export function registerServiceWorker({ onUpdateReady }) {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install also "changes" the controller; only reload for real updates.
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then(registration => {
    const offer = worker => onUpdateReady(() => worker.postMessage('SKIP_WAITING'));
    if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  }).catch(e => console.warn('Offline support could not start', e));
}
