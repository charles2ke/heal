// Heal's service worker. It keeps a copy of Heal's pages, styles and scripts in
// this browser, so Heal works offline. It never reads or sends your data, which
// stays in this browser's local storage.
//
// `npm run sw:version` writes VERSION and ASSETS (see scripts/sw-version.js).

const VERSION = '8769c934d61b';
const ASSETS = [
  'assets/css/styles.css',
  'assets/icon.svg',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/js/data/goals.js',
  'assets/js/data/kindness-ideas.js',
  'assets/js/dates.js',
  'assets/js/history.js',
  'assets/js/impact.js',
  'assets/js/kindness.js',
  'assets/js/pages/home.js',
  'assets/js/pages/impact.js',
  'assets/js/pages/together.js',
  'assets/js/pages/world.js',
  'assets/js/pages/you.js',
  'assets/js/pwa.js',
  'assets/js/store.js',
  'assets/js/theme-init.js',
  'assets/js/theme.js',
  'assets/js/ui.js',
  'assets/js/wellbeing.js',
  'assets/js/world.js',
  'impact.html',
  'index.html',
  'manifest.webmanifest',
  'together.html',
  'world.html',
  'you.html',
];

const CACHE = `heal-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Straight from the network, so an older copy in the HTTP cache isn't saved.
      await cache.addAll(ASSETS.map((path) => new Request(new URL(path, self.location).href, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('heal-') && key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

// Network first, so you get the latest Heal when you're online and the saved
// copy when you're not.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).catch(async (error) => {
      const cache = await caches.open(CACHE);
      // The site's address on its own means its home page.
      const target = url.pathname.endsWith('/') ? new URL('index.html', url).href : request;
      const saved = await cache.match(target, { ignoreSearch: true, ignoreVary: true });
      if (saved) return saved;
      throw error;
    }),
  );
});
