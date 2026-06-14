const VERSION = "111";
const CACHE = `album-2026-v${VERSION}`;
const APP_ASSETS = ["./", "index.html", `styles.css?v=${VERSION}`, `app.js?v=${VERSION}`, "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", `vendor/tesseract/tesseract.min.js?v=${VERSION}`];
const OCR_ASSETS = ["vendor/tesseract/worker.min.js", "vendor/tesseract/tesseract-core-simd-lstm.wasm.js", "vendor/tesseract/tesseract-core-simd-lstm.wasm", "vendor/tesseract/eng.traineddata.gz"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  caches.open(CACHE).then(cache => Promise.allSettled(OCR_ASSETS.map(asset => cache.add(asset))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const networkFirst = event.request.mode === "navigate" || new URL(event.request.url).searchParams.has("v");
  if (networkFirst) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (event.request.method === "GET" && response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
