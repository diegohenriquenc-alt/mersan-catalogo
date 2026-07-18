import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Mersan Calçados - Catálogo Loja 261',
        short_name: 'Mersan Catálogo',
        description: 'Catálogo digital da Mersan Calçados - Loja 261',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [
          /^\/ir-vendedor/,
          /^\/produto-foto\//,
          /^\/api\//
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\/produto\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'produtos-visitados',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
})
