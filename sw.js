// Personal Cash Flow - offline shell.
const VERSION = 'pcf-v2'
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './styles.css',
  './store.js',
  './app.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pcf-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // Navigation + shell: network first so updates land, cache as fallback.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/') || /\.(html|json)$/.test(url.pathname)) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
    )
    return
  }

  // Static assets: cache first.
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {})
          }
          return res
        }).catch(() => caches.match('./index.html'))
    )
  )
})
