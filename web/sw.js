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
