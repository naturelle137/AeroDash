import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { Given, When, Then } = createBdd()
const result = (page: Page) => page.getByRole('region', { name: 'Base performance distances', exact: true })
const ack = (page: Page) => page.getByLabel('Pilot-in-Command acknowledges extrapolated data', { exact: true })

Given('the verified synthetic Test POH aircraft is open in Performance', async ({ page }) => {
  await page.goto('/fleet')
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'Test-wiring-only.aerodash.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile: testPohAircraft() })),
  })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Test wiring only - no real POH')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.locator('nav a[href="/"]:visible').first().click()
  await page.getByRole('link', { name: 'Open Performance', exact: true }).click()
  const select = page.getByLabel('Aircraft profile', { exact: true })
  await select.selectOption(await select.locator('option').nth(1).getAttribute('value'))
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await page.getByLabel('Temperature (°C)', { exact: true }).fill('10')
})

When('the pilot enters mass {string} kg', async ({ page }, mass: string) => {
  await page.getByLabel('Mass (kg)', { exact: true }).fill(mass)
})
When('the pilot changes the temperature to {string} °C', async ({ page }, value: string) => {
  await page.getByLabel('Temperature (°C)', { exact: true }).fill(value)
})
When('the pilot acknowledges the extrapolated data', async ({ page }) => { await ack(page).check() })

Then('the extrapolated distances are withheld until acknowledged', async ({ page }) => {
  await expect(page.locator('[data-extrapolation]')).toContainText('EXTRAPOLATED DATA')
  await expect(ack(page)).not.toBeChecked()
  await expect(result(page).locator('dd')).toHaveCount(0)
})
Then('the extrapolated estimate {string} is shown with its penalty note', async ({ page }, value: string) => {
  await expect(result(page).locator('dd').first()).toContainText(value)
  await expect(result(page)).toContainText('ESTIMATED — EXTRAPOLATED (+20 % penalty)')
})
Then('the extrapolated estimate is shown only after a fresh acknowledgment', async ({ page }) => {
  await expect(ack(page)).not.toBeChecked()
  await expect(result(page).locator('dd')).toHaveCount(0)
  await ack(page).check()
  await expect(result(page).locator('dd')).toHaveCount(4)
})
Then('the distances are blocked beyond the extrapolation limit', async ({ page }) => {
  await expect(page.getByText('10 % extrapolation limit').first()).toBeVisible()
  await expect(ack(page)).toHaveCount(0)
  await expect(result(page).locator('dd')).toHaveCount(0)
})
Then('the distance {string} is shown at the documented minimum without an acknowledgment', async ({ page }, value: string) => {
  await expect(result(page).locator('dd').first()).toContainText(value)
  await expect(result(page)).not.toContainText('capped at the documented')
  await expect(ack(page)).toHaveCount(0)
})
Then('the extrapolation evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`extrapolation-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`extrapolation-${name}`, { path, contentType: 'image/png' })
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})
