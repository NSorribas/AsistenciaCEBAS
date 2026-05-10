/* =============================================
   CEBAS Asistencia - Service Worker
   Offline-first caching strategy
   ============================================= */

// ⚠️ Bump this version on every deployment to force cache invalidation
const CACHE_NAME = 'cebas-v3';
const APP_VERSION = '1.2.0';

// Static assets to pre-cache on install
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

// CDN assets to cache on first use
const CDN_HOSTS = [
  'cdn.jsdelivr.net'
];

// Supabase API host — always network-first
const API_HOSTS = [
  'supabase.co'
];

// ---- Install: pre-cache static assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for', CACHE_NAME);
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Skip waiting so the new SW activates immediately
      return self.skipWaiting();
    }).catch((err) => {
      console.warn('[SW] Pre-cache failed (some assets may be offline-only):', err);
    })
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // Claim all clients so the SW controls pages immediately
      return self.clients.claim();
    })
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

// ---- Fetch: routing strategy ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Supabase API calls → Network First
  if (API_HOSTS.some(host => url.hostname.endsWith(host))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Strategy 2: CDN libraries → Stale While Revalidate
  if (CDN_HOSTS.some(host => url.hostname === host)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Strategy 3: Local static assets → Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
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
    // For navigation requests, return the cached index.html
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

// ---- Stale While Revalidate: return cache, update in background ----
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

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
