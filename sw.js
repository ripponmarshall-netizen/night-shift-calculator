‘use strict’;

const CACHE = ‘ns-calculator-v1’;
const ASSETS = [
‘./’,
‘./index.html’,
‘./manifest.json’,
‘./icon-192.png’,
‘./icon-512.png’
];

// Install — cache all assets, then take control immediately
self.addEventListener(‘install’, e => {
e.waitUntil(
caches.open(CACHE)
.then(cache => cache.addAll(ASSETS))
.then(() => self.skipWaiting())
);
});

// Activate — remove old caches, then claim all clients
self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys()
.then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
.then(() => self.clients.claim())
);
});

// Fetch — only cache GET requests; pass everything else straight through
self.addEventListener(‘fetch’, e => {
if (e.request.method !== ‘GET’) return;
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request))
);
});
