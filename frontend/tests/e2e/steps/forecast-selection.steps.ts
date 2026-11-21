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

When('the pilot applies synthetic forecast values offline', async ({ page }) => {
  const forecast = page.getByRole('region', { name: 'Time-specific forecast' })
  await forecast.getByLabel('Forecast temperature').fill('12')
  await forecast.getByLabel('Forecast QNH').fill('1013')
  await forecast.getByLabel('Forecast wind direction').fill('180')
  await forecast.getByLabel('Forecast wind speed').fill('10')
  await forecast.getByLabel('Forecast wind unit').selectOption('m/s')
  await expect(page.locator('#wind-speed')).toHaveValue('20')
  await forecast.getByRole('button', { name: 'Apply forecast temperature' }).click()
  await forecast.getByRole('button', { name: 'Apply forecast QNH' }).click()
  await forecast.getByRole('button', { name: 'Apply forecast wind' }).click()
  await expect(page.locator('#performance-temperature')).toHaveValue('12')
  await expect(page.locator('#wind-speed')).toHaveValue('10')
  await expect(page.locator('#wind-direction')).toHaveValue('180')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(page.locator('#pa-qnh')).toHaveValue('1013')
  await expect(page.locator('#prep-card-weather')).toContainText('Pilot-entered forecast for arrival, Test airfield, 2030-06-01 12:30 local time')
})
Then('a manual override clears forecast provenance', async ({ page }) => {
  await page.locator('#performance-temperature').fill('26')
  await expect(page.locator('#prep-card-weather')).not.toContainText('temperature source: Pilot-entered forecast')
})
