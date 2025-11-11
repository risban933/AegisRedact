/**
 * Custom Service Worker Template
 * This file will be processed by Workbox to inject precache manifest
 */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache all assets (Workbox will inject the manifest here)
precacheAndRoute(self.__WB_MANIFEST);

// Listen for skip waiting message from update manager
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Received SKIP_WAITING message - activating new service worker');
    self.skipWaiting();
  }
});

// Handle activation
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Runtime caching strategies

// Images - Cache first
registerRoute(
  ({request}) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      })
    ]
  })
);

// Fonts - Cache first (long term)
registerRoute(
  ({request}) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
      })
    ]
  })
);

// PDF.js worker - Cache first
registerRoute(
  ({url}) => url.pathname.includes('pdf.worker'),
  new CacheFirst({
    cacheName: 'pdf-worker',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// External CDN resources - Stale while revalidate
registerRoute(
  ({url}) => url.origin.includes('cdn.'),
  new StaleWhileRevalidate({
    cacheName: 'external-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60 // 1 day
      })
    ]
  })
);

console.log('Service worker loaded with custom handlers');
