import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// Production gate for dev-only tooling (DP-016 vue-devtools). Kept as a plain
// boolean rather than a `defineConfig(({ command }) => …)` callback so the
// exported config stays an object: vitest.config.ts imports this value and
// passes it to `mergeConfig`, which throws on a callback-form config.
//
// `vite build` sets NODE_ENV='production'; the dev server and Vitest do not.
//
// NB: production console stripping (DP-011) is handled in the logger
// (`import.meta.env.PROD`), not here — Vite 8's default minifier is oxc, which
// ignores esbuild's `pure`/`drop` options, so a build-time strip here would be
// silently dropped.
const isProd = process.env.NODE_ENV === 'production'

// DP-004 / CS-012 (issue #263, PR #361 MINOR-7) — telemetry must never ship in
// a production bundle. `logger.telemetryTrace()` emits raw computation
// inputs/outputs (pilot-entered M&B / Performance / Fuel data) and BYPASSES
// the PII redactor by design — opting in is the operator's explicit
// acceptance that those values will land in `console.info`. Documentation
// alone (`.env.example`, CONTRIBUTING.md) is not enough; this guard fails the
// production build fast if `VITE_LOG_TELEMETRY` is truthy in the build
// environment, so an accidental `VITE_LOG_TELEMETRY=true pnpm build` cannot
// ship to pilots. Vitest does not set `NODE_ENV=production`, so the guard is
// inert for unit/integration test runs.
const TELEMETRY_TRUTHY_RE = /^(true|1|yes|on)$/i
if (isProd && typeof process.env.VITE_LOG_TELEMETRY === 'string' && TELEMETRY_TRUTHY_RE.test(process.env.VITE_LOG_TELEMETRY.trim())) {
  throw new Error(
    'AeroDash build aborted: VITE_LOG_TELEMETRY is enabled in a production build. ' +
      '`logger.telemetryTrace()` bypasses the PII redactor by design (DP-004 / CS-012, issue #263) ' +
      'and MUST NOT ship to pilots. Unset the env var or set it to `false` and rerun `pnpm build`.',
  )
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // DP-016 — vue-devtools must never ship in a production bundle (it exposes
    // component internals and store state). Enabled for dev only.
    ...(isProd ? [] : [vueDevTools()]),
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
