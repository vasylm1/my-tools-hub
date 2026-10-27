// Offline support: network-first for same-origin GETs, falling back to the last cached copy.
// Bump CACHE when the caching strategy changes; file updates need no bump because the network is tried first.
// SHELL lists every JS/CSS file so the whole hub works offline after the first visit (`npm run check` verifies it is complete).
const CACHE = 'mth-v1';
const SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/core/dom.js',
  '/js/core/form.js',
  '/js/core/icons.js',
  '/js/core/image.js',
  '/js/core/runner.js',
  '/js/lib/bmp.js',
  '/js/lib/csv.js',
  '/js/lib/datetime.js',
  '/js/lib/epub.js',
  '/js/lib/fake.js',
  '/js/lib/html2md.js',
  '/js/lib/ics.js',
  '/js/lib/json.js',
  '/js/lib/md.js',
  '/js/lib/office.js',
  '/js/lib/pa.js',
  '/js/lib/palette.js',
  '/js/lib/pdf.js',
  '/js/lib/qr.js',
  '/js/lib/sql.js',
  '/js/lib/text.js',
  '/js/lib/units.js',
  '/js/lib/vcard.js',
  '/js/lib/xlsx.js',
  '/js/lib/zip.js',
  '/js/main.js',
  '/js/profile.js',
  '/js/registry.js',
  '/js/theme-init.js',
  '/js/tools/data.js',
  '/js/tools/dev.js',
  '/js/tools/docs.js',
  '/js/tools/image.js',
  '/js/tools/text.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok && fresh.type === 'basic') {
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('/index.html')) || Response.error();
      throw err;
    }
  })());
});
