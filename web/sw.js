// Offline support: app files are fetched fresh when online and served from cache when offline; audio clips are cached on first use.
// The Pages build replaces __BUILD__ with the commit, so each deploy installs a new worker with its own cache of app files.

const BUILD = '__BUILD__';
const SHELL = `vw-shell-${BUILD}`;
const AUDIO = 'vw-audio-v3';
const SHELL_FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/main.js',
  'js/lesson.js',
  'js/vi.js',
  'js/audio.js',
  'js/store.js',
  'js/srs.js',
  'js/sync.js',
  'js/pictures.js',
  'js/deck.js',
  'js/push.js',
  'push.json',
  'lessons/index.json',
  'lessons/known.json',
  'audio/index.json',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== AUDIO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.m4a')) {
    if (event.request.headers.has('range')) return;
    event.respondWith(
      caches.open(AUDIO).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      }),
    );
    return;
  }
  // Always revalidate with the server, so a page never mixes files from two versions of the site.
  event.respondWith(
    fetch(new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html'))),
  );
});

// A notification from the editors: a new issue or an answer. Every push shows a notification, as iOS requires.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Học tiếng Việt', {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      tag: data.tag || 'vietwars',
      data: { url: data.url || './' },
    }),
  );
});

// Opening a notification brings the app forward at the page it is about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) {
        open.postMessage({ type: 'open', url });
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
