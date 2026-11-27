import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the pilot enters temperature {string}, wind from {string} at {string} kt and QNH {string} in Weather',
  async ({ page }, temperature: string, direction: string, speed: string, qnh: string) => {
    await page.locator('#weather-temperature').fill(temperature)
    await page.locator('#weather-wind-direction').fill(direction)
    await page.locator('#weather-wind-speed').fill(speed)
    await page.locator('#weather-qnh').fill(qnh)
  })

When('the pilot enters runway heading {string} in Performance', async ({ page }, heading: string) => {
  await page.locator('#wind-runway-heading').fill(heading)
})

Then('Performance shows the Weather temperature, wind and QNH as coming from Weather', async ({ page }) => {
  await expect(page.locator('#performance-temperature')).toHaveValue('')
  await expect(page.locator('#performance-temperature')).toHaveAttribute('placeholder', '15')
  await expect(page.locator('#performance-temperature-source')).toContainText('From Weather')
  await expect(page.getByText('Wind from Weather (manual entry)')).toBeVisible()
  await expect(page.locator('[aria-label="Wind components"]')).toContainText('Headwind10.0 kt')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(page.locator('#pa-qnh-source')).toContainText('QNH used: 1013 hPa')
  await expect(page.locator('#pa-qnh-source')).toContainText('From Weather')
})

When('the pilot types temperature {string} in Performance', async ({ page }, value: string) => {
  await page.locator('#performance-temperature').fill(value)
})

Then('Performance states that its temperature overrides Weather', async ({ page }) => {
  await expect(page.locator('#performance-temperature-source')).toContainText('overrides the Weather value')
  await expect(page.locator('#weather-temperature')).toHaveValue('15')
})

Then('the weather-first evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`weather-first-${name}.png`)
  await page.locator('#prep-card-performance').scrollIntoViewIfNeeded()
  await page.screenshot({ path })
  await $testInfo.attach(`weather-first-${name}`, { path, contentType: 'image/png' })
})
