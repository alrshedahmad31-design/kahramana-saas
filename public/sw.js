// Kahramana Drivers — Service Worker
// Cache strategy:
//   Static assets (JS/CSS/fonts/images) → cache-first
//   Navigation (HTML pages)             → network-first with offline fallback
//   Supabase API calls                  → network-only
//   Background sync                     → queued when offline, replayed on reconnect

const CACHE_NAME   = 'kahramana-driver-v1'
const OFFLINE_URL  = '/ar/driver/offline'

const PRECACHE = [
  '/ar/driver',
  '/en/driver',
  OFFLINE_URL,
  '/manifest.json',
  '/assets/favicon/web-app-manifest-192x192.png',
  '/assets/favicon/web-app-manifest-512x512.png',
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Always skip Supabase API and non-GET requests
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  if (url.pathname.startsWith('/api/')) return

  // Static assets — cache-first
  if (
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        }),
      ),
    )
    return
  }

  // Navigation — network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL) ?? new Response('Offline', { status: 503 }),
      ),
    )
    return
  }
})

// ── Background Sync — status updates queued when offline ─────────────────────

const SYNC_TAG = 'driver-status-sync'

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedUpdates())
  }
})

async function replayQueuedUpdates() {
  const db    = await openQueue()
  const items = await getAll(db)

  for (const item of items) {
    try {
      await fetch(item.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item.body),
      })
      await remove(db, item.id)
    } catch {
      // Will retry on next sync event
    }
  }
}

// ── Minimal IndexedDB queue for offline status updates ───────────────────────

function openQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('driver-queue', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('updates', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('updates', 'readonly')
    const req = tx.objectStore('updates').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function remove(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('updates', 'readwrite')
    const req = tx.objectStore('updates').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
