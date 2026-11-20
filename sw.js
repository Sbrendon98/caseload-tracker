// Offline support. Cache-first for the app shell, in a versioned cache.
//
// DEPLOYING AN UPDATE: bump VERSION below on every deploy. A new worker then installs in the
// background, waits, and the app offers "Update". tests/pwa.test.mjs fails if a file is missing here.

const VERSION = 'v2';
const CACHE = `caseload-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './js/app.js',
  './js/backup.js',
  './js/calendar.js',
  './js/csv.js',
  './js/dates.js',
  './js/db.js',
  './js/env.js',
  './js/merge.js',
  './js/model.js',
  './js/store.js',
  './js/swipe.js',
  './js/sw-register.js',
  './js/tutorials.js',
  './js/ui/backupAction.js',
  './js/ui/caseActions.js',
  './js/ui/dom.js',
  './js/ui/forms.js',
  './js/ui/format.js',
  './js/ui/layout.js',
  './js/ui/limit.js',
  './js/ui/modal.js',
  './js/ui/restore.js',
  './js/ui/router.js',
  './js/ui/share.js',
  './js/ui/swipeRow.js',
  './js/ui/tutorials.js',
  './js/ui/views/archived.js',
  './js/ui/views/calendar.js',
  './js/ui/views/detail.js',
  './js/ui/views/list.js',
  './js/ui/views/options.js',
];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's HTTP cache. GitHub Pages sends max-age=600, so without
  // it a new worker could copy stale files from the HTTP cache into the new versioned cache.
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })))),
  );
  // No skipWaiting here: an update waits until she taps "Update" so a screen is never swapped mid-entry.
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('caseload-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then(hit => hit
      ?? (request.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ?? fetch(request)),
  );
});
