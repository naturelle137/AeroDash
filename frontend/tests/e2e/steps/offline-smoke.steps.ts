import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

// Step definitions for offline-smoke.feature (REQ-SYS-001, REQ-SYS-002, #162 DoD)

const { Given, When, Then } = createBdd()

// E2E trace tags live in the .feature file only (STC §B.3 / §3.4).

Given('the pilot loads the app while online', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
})

When('the pilot goes offline', async ({ page }) => {
  await page.context().setOffline(true)
})

Then('the app shell is still visible', async ({ page }) => {
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
})

Then('the pilot can navigate to the Mass and Balance page', async ({ page }) => {
  // Use client-side navigation (click a link) — page.goto() sends a network request
  // even with a Service Worker, which fails offline. Vue Router handles the navigation
  // in-memory via the cached app shell (REQ-SYS-001, offline-first).
  const mbLink = page.getByRole('link', { name: /Flight Prep|Start flight preparation|mass.balance/i }).first()
  await expect(mbLink).toBeVisible()
  await mbLink.click()
  await expect(page).toHaveURL(/mass-balance/)
})

Then('the Mass and Balance page content is displayed', async ({ page }) => {
  await expect(page.getByRole('main')).toBeVisible()
})
