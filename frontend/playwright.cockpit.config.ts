import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  grep: /@cockpit-ux/,
  outputDir: 'test-results',
  use: { ...base.use, baseURL: 'http://localhost:4277', headless: true, trace: 'on' },
  webServer: { command: 'pnpm run preview --port 4277', port: 4277, reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
