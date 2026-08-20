import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const ACCENT = '#0E6E63'
const BG = '#F2F5F4'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icons/mask-icon.svg'],
      manifest: {
        id: '/',
        name: 'Panel Osobisty',
        short_name: 'Panel',
        description:
          'Osobisty panel do śledzenia wdzięczności, wydatków, godzin pracy, myśli i celów.',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BG,
        theme_color: ACCENT,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Kazdy skrot pomija ekran Start i otwiera formularz od razu.
        shortcuts: [
          {
            name: 'Dodaj wydatek',
            short_name: 'Wydatek',
            url: '/wydatki/nowy',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Zapisz godziny',
            short_name: 'Godziny',
            url: '/godziny-pracy/nowy',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Wdzięczność',
            short_name: 'Wdzięczność',
            url: '/wdziecznosc',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Zrób to teraz',
            short_name: 'Teraz',
            url: '/zrob-to-teraz',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
})
