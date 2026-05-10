'use strict';

// Update this version string on each deploy to bust the cache
const CACHE = 'ns-calculator-v7';
const FONT_CACHE = 'ns-fonts-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg',
  './icon-192.svg',
  './icon-512.svg',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './app.js'
];

// Install — cache all assets, then take control immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — remove old caches (preserve font cache), then claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app assets, stale-while-revalidate for Google Fonts
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Google Fonts: stale-while-revalidate (serve cached, update in background)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request)
            .then(response => {
              cache.put(e.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // App shell document: network-first (faster update rollouts)
  if (url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // App assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
