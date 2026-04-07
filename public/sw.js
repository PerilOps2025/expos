const CACHE = 'expos-v1'

const PRECACHE = [
  '/expos/',
  '/expos/index.html',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Network first for API calls
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    )
    return
  }

  // Cache first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }).catch(() => caches.match('/expos/'))
    })
  )
})

// Background sync for offline captures
self.addEventListener('sync', e => {
  if (e.tag === 'sync-captures') {
    e.waitUntil(syncOfflineCaptures())
  }
})

async function syncOfflineCaptures() {
  // Handled by the app on reconnect
}