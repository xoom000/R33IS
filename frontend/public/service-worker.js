/* eslint-disable no-restricted-globals */

// Import Workbox libraries from CDN in development,
// or from the build process in production
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js'
);

// If the import failed, fallback to the local copy
if (typeof workbox === 'undefined') {
  // eslint-disable-next-line no-console
  console.log('Workbox could not be loaded from CDN. Using local copy.');
  importScripts('workbox-sw.js');
}

// Configuration
workbox.setConfig({
  debug: false, // Set to true to see detailed debugging info
});

// Avoid having multiple service workers installed by using this as cache name
// This will make it easier to update service worker in the future
workbox.core.setCacheNameDetails({
  prefix: 'r33is',
  suffix: 'v1',
});

// Precache all the static assets generated in the build process
// (This array will be auto-populated by workbox-webpack-plugin)
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Static resources: cache-first strategy
workbox.routing.registerRoute(
  // Cache CSS, JS, and Web Worker requests with a Stale While Revalidate strategy
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'r33is-static-resources',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60, // Only keep up to 60 entries
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        purgeOnQuotaError: true, // Automatically cleanup if quota is exceeded
      }),
    ],
  })
);

// Images: cache-first strategy
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'r33is-images',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Fonts: cache-first strategy with long expiration
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: 'r33is-fonts',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// API requests: stale-while-revalidate with network timeout
// For API requests that don't need the freshest data, they'll be served from cache first,
// then updated in the background
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new workbox.strategies.NetworkFirst({
    cacheName: 'r33is-api',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 12 * 60 * 60, // 12 hours
        purgeOnQuotaError: true,
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200], // Cache successful and opaque responses
      }),
    ],
    networkTimeoutSeconds: 10, // If network takes more than 10 seconds, use the cache
  })
);

// Create a queue for background sync
const bgSyncQueue = new workbox.backgroundSync.Queue('r33is-offline-mutations', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
  onSync: async ({ queue }) => {
    let entry;
    // eslint-disable-next-line no-cond-assign
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        console.log('Background sync successful for request', entry.request.url);
      } catch (error) {
        console.error('Background sync failed for request', entry.request.url, error);
        // Put the entry back in the queue for retry
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
    console.log('Background sync queue completely processed');
  },
});

// Register a route for handling POST, PUT, DELETE requests when offline
workbox.routing.registerRoute(
  ({ request }) => 
    (request.method === 'POST' || 
     request.method === 'PUT' || 
     request.method === 'DELETE') &&
    request.url.includes('/api'),
  async ({ event }) => {
    try {
      // Try to fetch from network
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      // If network fetch fails, queue the request for later
      await bgSyncQueue.pushRequest({ request: event.request });
      
      // Return a 202 Accepted response to let the client know the request
      // has been received but will be processed later
      return new Response(
        JSON.stringify({
          offline: true,
          queued: true,
          message: 'This request has been queued for sync when online',
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
);

// Listen for the activate event and clear old caches
self.addEventListener('activate', (event) => {
  // Clean up any old cache versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Return true if you want to remove this cache
            return cacheName.startsWith('r33is') && !cacheName.includes('v1');
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Routing for navigation requests (HTML pages)
workbox.routing.registerRoute(
  // Match any navigation request (HTML pages)
  ({ request }) => request.mode === 'navigate',
  // Use a Network First strategy
  new workbox.strategies.NetworkFirst({
    // Put these cached files in a named cache
    cacheName: 'r33is-html-cache',
    plugins: [
      // Cache for a maximum of 1 day
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60,
        maxEntries: 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Serve the fallback HTML for any navigation request that fails
workbox.routing.setCatchHandler(({ event }) => {
  // Return the fallback HTML page for navigation requests
  if (event.request.mode === 'navigate') {
    return caches.match('/index.html');
  }
  
  // If we don't have a fallback, return a 404 response
  return Response.error();
});