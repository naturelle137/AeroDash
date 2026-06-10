import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('the pilot opens the airport page', async ({ page }) => {
  await page.goto('/airport')
  await expect(page.locator('#icao-search-input')).toBeVisible()
})

When('the pilot searches for the unlisted airport {string}', async ({ page }, icao: string) => {
  await page.locator('#icao-search-input').fill(icao)
  await page.locator('form.icao-search button[type="submit"]').click()
})

Then('manual airport entry is offered for {string}', async ({ page }, icao: string) => {
  await expect(page.locator('.manual-entry')).toBeVisible()
  await expect(page.locator('.manual-entry-banner')).toContainText(icao)
})

Given('the pilot has entered a manual runway {int} m long', async ({ page }, length: number) => {
  await page.locator('#icao-search-input').fill('ZZZZ')
  await page.locator('form.icao-search button[type="submit"]').click()
  await expect(page.locator('.manual-entry')).toBeVisible()
  await page.locator('#runway-tora').fill(String(length))
})

When('the pilot tries to compute performance without a surface condition', async ({ page }) => {
  await page.locator('.actions button.btn-primary').click()
})

Then('performance computation is refused pending a surface condition', async ({ page }) => {
  const rejection = page.locator('.compute-rejection')
  await expect(rejection).toBeVisible()
  await expect(rejection).toContainText(/surface condition/i)
})

When('the pilot selects the runway surface condition {string}', async ({ page }, label: string) => {
  await page.locator('#runway-surface-condition').selectOption({ label })
})

Then('performance computation is ready to proceed', async ({ page }) => {
  await expect(page.locator('.compute-ready')).toBeVisible()
})

When('the pilot saves the manual runway', async ({ page }) => {
  await page.locator('.actions button.btn-secondary').click()
})

Then('the runway data is confirmed saved', async ({ page }) => {
  await expect(page.locator('.save-confirmation')).toBeVisible()
})
