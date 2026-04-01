import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

// ─── Shared steps — used by multiple phases ────────────────────────────────

Given('the pilot starts a new flight preparation', async ({ page }) => {
  await page.goto('/mass-balance')
  await expect(page.getByLabel('Select aircraft')).toBeVisible()
})

When('the pilot selects aircraft {string}', async ({ page }, registration: string) => {
  const select = page.getByLabel('Select aircraft')
  const option = select.locator('option', { hasText: registration })
  const label = await option.textContent()
  await select.selectOption({ label: label!.trim() })
  await expect(page.locator('.aircraft-label')).toContainText(registration)
})

Then('no critical notifications are displayed', async ({ page }) => {
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical')).toHaveCount(0)
})

Then('the total mass is within MTOM', async ({ page }) => {
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical', { hasText: 'MTOM Exceeded' })).toHaveCount(0)
})
