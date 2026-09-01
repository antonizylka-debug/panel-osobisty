import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const ACCENT = '#4A505A'
const BG = '#EAECED'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // Wstrzykiwane na etapie budowania — pokazywane w Ustawieniach → Diagnostyka,
  // zeby dalo sie stwierdzic, ktora wersja faktycznie siedzi w przegladarce.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Wylaczone w dev: service worker w trybie deweloperskim potrafi
      // przytrzymac stary, zbuforowany bundle mimo zmian w kodzie — trzeba
      // zamknac wszystkie karty, zeby nowy SW przejal kontrole. Podczas
      // aktywnej pracy nad UI to tylko myli ("zmiana niby jest, a nie widac").
      // Produkcyjny build i tak dostaje pelne PWA/offline bez tej flagi.
      devOptions: { enabled: false },
      includeAssets: ['icons/mask-icon.svg'],
      manifest: {
        id: '/',
        name: 'Cashflow',
        short_name: 'Cashflow',
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
