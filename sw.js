// sw.js — Service Worker: registration and lifecycle (Session 17), fetch
// interception (Session 18), named strategies routed by resource type
// (Session 21).
//
// install pre-caches the app shell. activate drops any cache that isn't the
// current CACHE_NAME, so a version bump also cleans up old versions. fetch
// picks a strategy per request:
//   - /icons/  -> cache first   (immutable-ish assets, cheapest to reuse)
//   - /api/    -> network first (not built yet, prepared for when it exists)
//   - anything else (the app shell) -> stale-while-revalidate

const CACHE_NAME = "task-manager-v3";
const CORE_ASSETS = [
  "/index.html",
  "/css/styles.css",
  "/app.js",
  "/tasks.js",
  "/db.js",
  "/crypto.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    });
  });
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    })
    .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const update = fetch(request).then((response) => {
        cache.put(request, response.clone());
        return response;
      });
      return cached || update;
    })
  );
}

// Routed by resource type (Session 21): no longer a single strategy for everything.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(event.request));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
