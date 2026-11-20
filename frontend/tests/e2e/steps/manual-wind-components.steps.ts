import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()
const panel = (page: Page) => page.getByRole('region', { name: 'Manual wind components', exact: true })
const result = (page: Page) => panel(page).getByRole('status', { name: 'Wind components', exact: true })

When('the pilot enters runway heading {string}, wind from {string} and speed {string} {string}',
  async ({ page }, heading: string, direction: string, speed: string, unit: string) => {
    await panel(page).getByLabel('Runway heading (°, 1–360)', { exact: true }).fill(heading)
    await panel(page).getByLabel('Wind from (°, 1–360)', { exact: true }).fill(direction)
    await panel(page).getByLabel('Wind speed', { exact: true }).fill(speed)
    await panel(page).getByLabel('Wind speed unit', { exact: true }).selectOption(unit)
  })

Then('the wind components show {string} {string} and crosswind {string}', async ({ page }, label: string, value: string, cross: string) => {
  await expect(result(page).locator('dt').nth(0)).toHaveText(label)
  await expect(result(page).locator('dd').nth(0)).toHaveText(value)
  await expect(result(page).locator('dd').nth(1)).toHaveText(cross)
})

Then('the wind components are labelled as user-entered and advisory', async ({ page }) => {
  await expect(panel(page)).toContainText('User-entered — advisory only.')
})

Then('no wind components are shown', async ({ page }) => {
  await expect(result(page).locator('dd')).toHaveCount(0)
  await expect(result(page)).toContainText('No wind components')
})

Then('the wind component evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`wind-components-${name}.png`)
  await panel(page).screenshot({ path })
  await $testInfo.attach(`wind-components-${name}`, { path, contentType: 'image/png' })
})
