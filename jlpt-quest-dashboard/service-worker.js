const CACHE = "jlpt-quest-v12";
const SHELL = [
  "./",
  "./index.html",
  "./app.js?v=12",
  "./vendor/supabase.min.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./fonts/dm-sans-latin.woff2",
  "./fonts/shippori-mincho-700-latin.woff2",
  "./fonts/shippori-mincho-800-latin.woff2",
  "./assets/campaign-path.webp",
  "./assets/kitsune-guide.webp",
  "./assets/n5-world-map-v2.jpg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "../anki-history.json"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
