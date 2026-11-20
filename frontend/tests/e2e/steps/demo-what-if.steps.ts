import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the instructor starts a demo', async ({ page }) => {
  await page.getByTestId('demo-start').click()
  await expect(page.getByTestId('demo-banner')).toBeVisible()
})

When('the instructor discards the demo', async ({ page }) => {
  await page.getByTestId('demo-discard').click()
})

Then('the demo banner is not displayed', async ({ page }) => {
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
})

Then('the saved plan still holds the reduced baggage', async ({ page }) => {
  // Autosave is debounced; wait past it so a leaked demo write would be stored.
  await page.waitForTimeout(1000)
  const stored = await page.evaluate(() => localStorage.getItem('aerodash:session:payload'))
  expect(stored).not.toBeNull()
  const weights = (JSON.parse(stored!) as { stations: { weight: number }[] }).stations.map(
    (s) => s.weight,
  )
  // Demo set 23 kg in the second baggage area; the saved plan holds 0.
  expect(weights).not.toContain(23)
})

Then('the Flight Prep temperature is {string} °C', async ({ page }, temperature: string) => {
  await expect(page.getByLabel('Temperature (°C)', { exact: true })).toHaveValue(temperature)
})

When('the instructor changes demo unit preferences', async ({ page }) => {
  const units = page.getByRole('group', { name: 'Unit preferences' })
  await units.getByLabel('Field elevation').selectOption('m')
  await units.getByLabel('Declared runway distances').selectOption('ft')
  await expect(units).toContainText('Demo unit choices are temporary')
})

Then('the saved unit preferences are unchanged', async ({ page }) => {
  expect(await page.evaluate(() => localStorage.getItem('aerodash.preferences.units.v1'))).toBeNull()
})

Then('the original unit preferences are restored', async ({ page }) => {
  const units = page.getByRole('group', { name: 'Unit preferences' })
  await expect(units.getByLabel('Field elevation')).toHaveValue('ft')
  await expect(units.getByLabel('Declared runway distances')).toHaveValue('m')
})
