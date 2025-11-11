import { generateSW } from 'workbox-build';

await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,webmanifest,png,svg,woff2,mjs}'],
  swDest: 'dist/sw.js',
  skipWaiting: true,
  clientsClaim: true,

  // Offline fallback configuration
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/api/],

  runtimeCaching: [
    // Images
    {
      urlPattern: ({request}) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 3600 // 7 days
        }
      }
    },
    // Fonts
    {
      urlPattern: ({request}) => request.destination === 'font',
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 3600 // 1 year
        }
      }
    },
    // PDF.js worker
    {
      urlPattern: /pdf\.worker\.min\.mjs$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pdf-worker',
        expiration: {
          maxEntries: 5,
          maxAgeSeconds: 30 * 24 * 3600 // 30 days
        }
      }
    },
    // External CDN resources
    {
      urlPattern: /^https:\/\/cdn\./,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'external-resources',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 3600 // 1 day
        }
      }
    }
  ]
});

console.log('Service worker generated successfully');
