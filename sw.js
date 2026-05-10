/* =============================================
   CEBAS Asistencia - Service Worker
   Auto-updating caching strategy:
   - Code (HTML/JS/CSS) → Stale While Revalidate (auto-updates!)
   - Images/icons → Cache First (rarely change)
   - Supabase API → Network First
   - CDN libraries → Stale While Revalidate
   
   No need to bump CACHE_NAME on every deploy.
   Only bump when you want to force a full cache clear.
   ============================================= */

const CACHE_NAME = 'cebas-cache';
const APP_VERSION = '1.2.0';

// Assets to pre-cache on install (for instant first load + offline support)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/db.js',
  './js/students.js',
  './js/schedule.js',
  './js/attendance.js',
  './js/justificaciones.js',
  './js/reports.js',
  './js/config.js',
  './js/app.js',
  './manifest.json',
  './assets/favicon.svg',
  './assets/favicon-16.png',
  './assets/logo-cebas48.png',
  './assets/icon-192.png',
  './assets/apple-touch-icon.png'
];

// Image extensions → cache-first (they rarely change)
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];

// Supabase API host → network-first
const API_HOSTS = ['supabase.co'];

// CDN host → stale-while-revalidate
const CDN_HOSTS = ['cdn.jsdelivr.net'];

// ---- Install: pre-cache assets for offline ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
    .catch((err) => console.warn('[SW] Pre-cache partial fail:', err))
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Handle messages from the app ----
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION, cache: CACHE_NAME });
  }
});

// ---- Fetch: smart routing ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Supabase API → Network First
  if (API_HOSTS.some(host => url.hostname.endsWith(host))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Strategy 2: CDN libraries → Stale While Revalidate
  if (CDN_HOSTS.some(host => url.hostname === host)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Strategy 3: Local assets — split by type
  if (url.origin === self.location.origin) {
    const isImage = IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext));

    if (isImage) {
      // Images/icons: Cache First (rarely change, safe to cache aggressively)
      event.respondWith(cacheFirst(event.request));
    } else {
      // Code (HTML/JS/CSS/manifest): Stale While Revalidate
      // → Serves cached version instantly, fetches fresh in background
      // → Next page load gets the new version automatically!
      // → NO more manual cache bumping needed!
      event.respondWith(staleWhileRevalidate(event.request));
    }
    return;
  }

  // Strategy 4: Everything else → Network with cache fallback
  event.respondWith(networkWithCacheFallback(event.request));
});

// ---- Cache First: check cache, fallback to network ----
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// ---- Network First: try network, fallback to cache ----
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ---- Stale While Revalidate: return cache instantly, update in background ----
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await caches.match(request);

  // Fetch fresh version in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// ---- Network with Cache Fallback ----
async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}
