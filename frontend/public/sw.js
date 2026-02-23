const CACHE_NAME = 'ielts-learning-__BUILD_TIMESTAMP__';
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

function shouldHandle(event) {
  if (!event.request.url.startsWith('http')) return false;
  if (event.request.method !== 'GET') return false;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return false;
  if (requestUrl.pathname.startsWith('/api')) return false;
  if (requestUrl.pathname.includes('hot-update') || requestUrl.pathname.includes('sockjs-node')) return false;

  return true;
}

async function networkFirstNavigation(event) {
  try {
    const networkResponse = await fetch(new Request(event.request, { cache: 'reload' }));
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) return cachedIndex;
    throw error;
  }
}

async function networkFirstAsset(event) {
  try {
    const networkResponse = await fetch(new Request(event.request, { cache: 'reload' }));
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const fetchPromise = fetch(event.request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cached) return cached;
  const network = await fetchPromise;
  return network || Response.error();
}

self.addEventListener('fetch', (event) => {
  if (!shouldHandle(event)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  const destination = event.request.destination;
  const isCodeAsset =
    destination === 'script' ||
    destination === 'style' ||
    destination === 'font' ||
    destination === 'manifest';

  if (isCodeAsset) {
    event.respondWith(networkFirstAsset(event));
    return;
  }

  if (destination === 'image') {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || Response.error();
    })
  );
});
