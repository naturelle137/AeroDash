import { defineConfig, devices } from '@playwright/test'

// This suite always serves the built artifact: the dev server has no service worker.
export default defineConfig({
  testDir: './tests/offline-production',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'offline-report', open: 'never' }]],
  use: { baseURL: 'http://localhost:4278', headless: true, trace: 'on' },
  webServer: { command: 'pnpm run preview --port 4278 --strictPort', port: 4278, reuseExistingServer: false },
  projects: [390, 1440].map((width) => ({
    name: `chromium-${width}`,
    use: { ...devices['Desktop Chrome'], viewport: { width, height: 1000 } },
  })),
})
