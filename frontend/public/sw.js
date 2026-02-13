const CACHE_NAME = 'ielts-learning-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Ignore chrome-extension schemes and other non-http protocols
    if (!event.request.url.startsWith('http')) {
        return;
    }

    // Ignore non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Ignore Vite HMR and other dev server requests
    if (event.request.url.includes('hot-update') || event.request.url.includes('socket')) {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Do not intercept cross-origin requests (e.g. API on another domain)
    // to avoid adding latency and CORS-related SW errors.
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // Never cache or proxy API calls through SW.
    if (requestUrl.pathname.startsWith('/api')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    // Cache the fetched resource
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                }).catch(() => {
                    // Graceful fallback when network is unavailable.
                    return response || Response.error();
                });
            })
    );
});
