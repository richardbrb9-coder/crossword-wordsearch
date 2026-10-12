// Bump the version whenever caching changes; caches from older versions are deleted on activate.
const CACHE_NAME = 'puzzle-app-v2';

// The app is a single page: every navigation is served this page
const APP_SHELL = '/';

// Core files cached up front so the app can start offline
const ASSETS_TO_CACHE = [
  APP_SHELL,
  '/words.json',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event: cache the core files and take over straight away
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate Event: delete old caches. If this replaced an older version, reload open
// pages once, because they were started from that version's out-of-date page.
self.addEventListener('activate', (event) => {
  const cleanUp = (async () => {
    const oldCaches = (await caches.keys()).filter((name) => name !== CACHE_NAME);
    await Promise.all(oldCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
    return oldCaches.length > 0;
  })();
  event.waitUntil(cleanUp);

  // Reload outside waitUntil: the reload's request waits for this worker to finish activating
  cleanUp.then(async (replacedOlderVersion) => {
    if (!replacedOlderVersion) return;
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach((client) => client.navigate(client.url).catch(() => {}));
  });
});

// Network first: always try for the latest version, fall back to the cache when offline
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

// Cache first for built files in /assets/: their names change whenever their contents do
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Never cache the HTML page Netlify returns for a file that doesn't exist
  const contentType = response.headers.get('Content-Type') || '';
  if (response.ok && !contentType.includes('text/html')) {
    await cache.put(request, response.clone());
  }
  return response;
}

// Remove built files the current page no longer uses, so old versions don't pile up
async function pruneOldAssets(pageResponse) {
  const html = await pageResponse.text();
  const inUse = new Set(html.match(/\/assets\/[^"'\s)]+/g) || []);
  const cache = await caches.open(CACHE_NAME);
  const cachedRequests = await cache.keys();
  await Promise.all(cachedRequests.map((request) => {
    const path = new URL(request.url).pathname;
    return path.startsWith('/assets/') && !inUse.has(path) ? cache.delete(request) : null;
  }));
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Leave other sites (e.g. Google Fonts) and non-GET requests to the browser
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, APP_SHELL).then((response) => {
        if (response.ok) {
          event.waitUntil(pruneOldAssets(response.clone()).catch(() => {}));
        }
        return response;
      })
    );
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request, request));
  }
});
