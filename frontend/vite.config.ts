import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: 'AeroDash',
        short_name: 'AeroDash',
        description: 'Safety-critical offline-first aviation flight preparation',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.3.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
    __MIN_SAFE_VERSION__: JSON.stringify('0.3.0'),
  },
  build: {
    // Pinned to Vite 7's previous `baseline-widely-available` resolution so the
    // Vite 8 upgrade preserves the browser-compatibility envelope users had
    // before the bump. Vite 8 silently advanced the preset to chrome111 /
    // edge111 / firefox114 / safari16.4 — a safety-critical aviation PWA
    // should not drop pilots on older iPads or Chromebooks without an
    // explicit decision.
    target: ['chrome107', 'edge107', 'firefox104', 'safari16.0'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
