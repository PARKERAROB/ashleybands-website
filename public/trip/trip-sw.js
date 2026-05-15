const CACHE_NAME = "ashley-spring-trip-2026-v1";
const URLS = [
  "/trip/",
  "/trip/index.html",
  "/trip/bus-checkoff-2026.html",
  "/trip/chaperone-field-guide-2026.html",
  "/trip/student-checkin-instructions-2026.html",
  "/trip/percussion-lead-checklist-2026-05-15.html"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith("/trip/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || caches.match("/trip/")))
  );
});
