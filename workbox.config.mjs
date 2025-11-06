import { generateSW } from 'workbox-build';

await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,webmanifest,png,svg,woff2,mjs}'],
  swDest: 'dist/sw.js',
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({request}) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 3600
        }
      }
    }
  ]
});

console.log('Service worker generated successfully');
