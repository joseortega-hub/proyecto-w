import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Sintonía',
        short_name: 'Sintonía',
        description: 'Dime cómo estás y te pongo lo que encaja.',
        lang: 'es',
        theme_color: '#3d4bf0',
        background_color: '#f3f4f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('jamendo.com') && url.searchParams.get('type') === 'album',
            handler: 'CacheFirst',
            options: { cacheName: 'covers', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
