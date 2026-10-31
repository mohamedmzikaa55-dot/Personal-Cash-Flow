// Personal Cash Flow - offline shell.
// Bump VERSION with every release: browsers only install a new service worker
// when this file's bytes change, and the shell files below are served
// cache-first from VERSION — so without a bump, "Check for update" compares
// identical bytes, finds nothing, and keeps serving the cached old files.
const VERSION = 'pcf-v29'
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
      .then(() => {})
  )
})

// The app asks us to activate after it has exported the auto-backup, and asks
// which release is running so it can catch a stuck update check.
self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return }
  if (data.type === 'GET_VERSION') {
    const reply = event.ports && event.ports[0]
    if (reply) reply.postMessage({ type: 'VERSION', version: VERSION })
  }
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

  // The worker script is fetched by the page right before an update check to
  // bust the HTTP cache, so it must never be served from — or stored in — this
  // cache, or the check would keep comparing the old bytes.
  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(event.request))
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
