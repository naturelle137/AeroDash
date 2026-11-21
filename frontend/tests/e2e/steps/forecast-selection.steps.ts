import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the pilot selects a forecast location and time', async ({ page }) => {
  const forecast = page.getByRole('region', { name: 'Time-specific forecast' })
  await forecast.getByLabel('Flight phase').selectOption('arrival')
  await forecast.getByLabel('Location').fill('Test airfield')
  await forecast.getByLabel('Local date and time').fill('2030-06-01T12:30')
})
Then('the forecast is unavailable and manual wind remains unchanged', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Check METAR' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Time-specific forecast' }).getByRole('status')).toContainText('No forecast source is configured')
  await expect(page.getByLabel('Wind speed', { exact: true })).toHaveValue('20')
})
When('the browser goes offline for forecast planning', async ({ context }) => { await context.setOffline(true) })
Then('the forecast selection and manual wind remain available offline', async ({ page }) => {
  const forecast = page.getByRole('region', { name: 'Time-specific forecast' })
  await expect(forecast.getByRole('status')).toContainText('Browser offline')
  await expect(forecast.getByLabel('Flight phase')).toHaveValue('arrival')
  await expect(forecast.getByLabel('Location')).toHaveValue('Test airfield')
  await expect(forecast.getByLabel('Local date and time')).toHaveValue('2030-06-01T12:30')
  await expect(page.getByLabel('Wind speed', { exact: true })).toHaveValue('20')
})
Then('the forecast selection evidence is captured as {string}', async ({ page, $testInfo }, width: string) => {
  await page.getByRole('region', { name: 'Time-specific forecast' }).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`forecast-${width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach(`forecast-${width}`, { path, contentType: 'image/png' })
})
