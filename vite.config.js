import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Configuração do Vite para o Catálogo Mersan Calçados
// Etapa 1: estrutura base + PWA
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
            // Placeholder até a logo oficial da Mersan ser fornecida em PNG.
            // Substitua estes arquivos em /public/icons/ mantendo os mesmos nomes.
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
        // /ir-vendedor, /produto-foto e /api são rotas que só existem no
        // servidor (não são telas do app React) — sem essa exclusão, o
        // Service Worker "sequestra" a navegação para elas e devolve o
        // esqueleto do app em vez de deixar a rota real do servidor
        // responder, deixando a tela em branco (foi o que travava o
        // redirecionamento pro WhatsApp do vendedor).
        navigateFallbackDenylist: [
          /^\/ir-vendedor/,
          /^\/produto-foto\//,
          /^\/api\//
        ],
        // Cacheia páginas de produto já visitadas para funcionamento offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/produto\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'produtos-visitados',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 dias
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
