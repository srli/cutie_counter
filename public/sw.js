// Offline support. Pages load fresh when online and fall back to the cache
// offline; everything else (code, art, packs) is served from cache and
// refreshed in the background.
const CACHE = 'cutie-counter-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'packs/index.json'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res })
        .catch(() => caches.match('index.html')),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const fresh = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res })
        .catch(() => cached)
      return cached ?? fresh
    }),
  )
})
