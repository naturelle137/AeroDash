import { defineConfig, devices } from '@playwright/test'

// Screenshot audit of the main views in both themes and both reference widths.
// Output goes to THEME_AUDIT_DIR (default test-results/theme-audit).
export default defineConfig({
  testDir: 'tests/theme-audit',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:4278', headless: true },
  webServer: { command: 'pnpm run preview --port 4278', port: 4278, reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
