import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()
const warning = (page: Page) => page.locator('[data-notification="WARN-PF-001"]')

When('the pilot enters an obstacle height {string} {string} at distance {string} {string}',
  async ({ page }, height: string, heightUnit: string, distance: string, distanceUnit: string) => {
    await page.locator('#performance-obstacle-height-unit').selectOption(heightUnit)
    await page.locator('#performance-obstacle-distance-unit').selectOption(distanceUnit)
    await page.locator('#performance-obstacle-height').fill(height)
    await page.locator('#performance-obstacle-distance').fill(distance)
  })

When('the pilot clears the obstacle', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear obstacle' }).click()
})

When('the pilot reloads the obstacle entry', async ({ page }) => {
  await page.waitForTimeout(500)
  await page.reload()
})

When('the pilot changes and reloads the Flight Prep obstacle', async ({ page }) => {
  await page.locator('#performance-obstacle-height').fill('60')
  await page.locator('#performance-obstacle-height').fill('50')
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('aerodash:flightprep:draft'))).toContain('"distance":"600"')
  await page.reload()
  await expect(page.locator('#performance-obstacle-height')).toHaveValue('50')
  await expect(page.locator('#performance-obstacle-height-unit')).toHaveValue('ft')
  await expect(page.locator('#performance-obstacle-distance')).toHaveValue('600')
  await expect(page.locator('#performance-obstacle-distance-unit')).toHaveValue('m')
})

When('the pilot closes the briefing and clears the obstacle', async ({ page }) => {
  await page.getByRole('dialog', { name: 'Briefing Pack preview' }).getByRole('button', { name: 'Back to preparation' }).click()
  await page.getByRole('button', { name: 'Clear obstacle' }).click()
})

Then('the unverified obstacle warning is shown', async ({ page }) => {
  await expect(warning(page)).toContainText('WARN-PF-001')
  await expect(warning(page)).toContainText('Unverified obstacle data in use')
  await expect(page.locator('[data-obstacle-active]')).toContainText('Unverified, not checked for clearance')
  await expect(page.locator('[data-obstacle-active]')).toContainText('Approximately 2.540%')
  await expect(page.locator('[data-obstacle-active]')).toContainText('clearance cannot be determined')
})

Then('no unverified obstacle warning is shown', async ({ page }) => {
  await expect(warning(page)).toHaveCount(0)
})

Then('the obstacle height error {string} is shown', async ({ page }, text: string) => {
  await expect(page.locator('#performance-obstacle-height-error')).toHaveText(text)
})

Then('the obstacle distance error {string} is shown', async ({ page }, text: string) => {
  await expect(page.locator('#performance-obstacle-distance-error')).toHaveText(text)
})

Then('the obstacle evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`obstacle-${name}.png`)
  await page.locator('.obstacle-inputs').screenshot({ path })
  await $testInfo.attach(`obstacle-${name}`, { path, contentType: 'image/png' })
})
