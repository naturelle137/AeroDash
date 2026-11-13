import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  grep: /@touch-flow/,
  outputDir: 'test-results-touch',
  use: { ...base.use, baseURL: 'http://localhost:4275', trace: 'on', headless: true },
  webServer: { command: 'pnpm run preview --port 4275', port: 4275, reuseExistingServer: false },
  projects: [
    { name: 'touch-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
})
