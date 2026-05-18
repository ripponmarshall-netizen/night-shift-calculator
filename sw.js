"use strict";

// Bump this on each deploy to bust the cache
const CACHE = "ns-calculator-v9";
const FONT_CACHE = "ns-fonts-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.css",
  "./helpers.jsx",
  "./components.jsx",
  "./modals.jsx",
  "./templates.jsx",
  "./calendar.jsx",
  "./summary.jsx",
  "./share.jsx",
  "./reconcile.jsx",
  "./ytd.jsx",
  "./snapshots.jsx",
  "./app.jsx",
  "./logo.svg",
  "./icon-192.svg",
  "./icon-512.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Google Fonts: stale-while-revalidate
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    e.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const networkFetch = fetch(e.request)
            .then((response) => {
              cache.put(e.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        }),
      ),
    );
    return;
  }

  // App shell document: network-first
  if (
    url.pathname.endsWith("/index.html") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/")
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() =>
          caches
            .match(e.request)
            .then((cached) => cached || caches.match("./index.html")),
        ),
    );
    return;
  }

  // App assets: cache-first, falling back to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (
            res &&
            res.status === 200 &&
            url.origin === self.location.origin
          ) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});
