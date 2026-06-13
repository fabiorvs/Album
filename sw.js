const CACHE = "album-2026-v9";
const APP_ASSETS = ["./", "index.html", "styles.css", "app.js", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "vendor/tesseract/tesseract.min.js"];
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
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (event.request.method === "GET" && response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
