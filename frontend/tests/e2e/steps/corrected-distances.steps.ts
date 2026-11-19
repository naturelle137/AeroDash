import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { Given, When, Then } = createBdd()
const takeoff = (page: Page) => page.getByRole('region', { name: 'Takeoff corrected distances', exact: true })

Given('the production app is cached for offline performance', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
})

When('the pilot clears the runway surface condition', async ({ page }) => {
  await page.getByLabel('Surface condition', { exact: true }).selectOption('')
})

When('I import and verify a synthetic POH profile for registration {string} declaring type {string} and maximum mass {int} kg',
  async ({ page }, registration: string, icaoTypeDesignator: string, mtom: number) => {
    const base = testPohAircraft()
    const profile = { ...base, registration, icaoTypeDesignator, certificationCategories: [{ ...base.certificationCategories[0]!, mtom }], status: 'draft' }
    await page.goto('/fleet')
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'Test-wiring-only.aerodash.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await page.getByRole('button', { name: `Verify ${registration}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Verifier initials').fill('TS')
    await dialog.getByLabel('POH revision').fill('Test wiring only - no real POH')
    await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(dialog).toBeHidden()
  })

When('the pilot enters takeoff headwind {string} kt and slope {string} %', async ({ page }, headwind: string, slope: string) => {
  await page.getByLabel('Headwind component (kt, negative = tailwind)').first().fill(headwind)
  await page.getByLabel('Runway slope (%, positive = uphill)').first().fill(slope)
})

Then('the corrected takeoff distances are {string}', async ({ page }, expected: string) => {
  const region = takeoff(page)
  await expect(region).toBeVisible()
  if (expected.startsWith('unavailable: ')) {
    await expect(region).toContainText(`Not corrected: ${expected.slice('unavailable: '.length)}`)
    return
  }
  const [, value] = /final (\d+ m)/.exec(expected)!
  await expect(region).toContainText('Tecnam P2008 JC Aircraft Flight Manual')
  await expect(region.locator('dd').first()).toContainText(value!)
})

Then('the corrected distance evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await takeoff(page).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`corrected-distances-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Corrected distances ${name}`, { path, contentType: 'image/png' })
})

Then('the takeoff runway comparison is {string}', async ({ page }, verdict: string) => {
  await expect(takeoff(page).locator('.comparison')).toContainText(verdict)
})

When('the pilot selects the takeoff safety factor {string}', async ({ page }, preset: string) => {
  await page.getByLabel('Safety factor').first().selectOption({ label: preset })
})

Then('the takeoff safety factor warning is {string}', async ({ page }, state: string) => {
  const warning = takeoff(page).locator('[data-warning="WARN-PF-002"]')
  if (state === 'shown') await expect(warning).toContainText('WARN-PF-002')
  else await expect(warning).toHaveCount(0)
})

When('the pilot enters landing headwind {string} kt and slope {string} %', async ({ page }, headwind: string, slope: string) => {
  await page.getByLabel('Headwind component (kt, negative = tailwind)').last().fill(headwind)
  await page.getByLabel('Runway slope (%, positive = uphill)').last().fill(slope)
})

Then('the landing correction shows its source and final ground roll {string}', async ({ page }, value: string) => {
  const region = page.getByRole('region', { name: 'Landing corrected distances', exact: true })
  await expect(region).toContainText('Tecnam P2008 JC Aircraft Flight Manual')
  await expect(region.locator('dd').first()).toContainText(value)
  await expect(takeoff(page)).toContainText('Not corrected: Enter the headwind component')
})

Then('the landing correction evidence is captured as {string}', async ({ page, $testInfo }, width: string) => {
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.getByRole('region', { name: 'Landing corrected distances', exact: true }).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`landing-correction-${width}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Landing correction ${width}`, { path, contentType: 'image/png' })
})

When('the pilot selects the imported aircraft {string} in Flight Prep', async ({ page }, registration: string) => {
  await page.locator('nav a[href="/mass-balance"]:visible').first().click()
  const select = page.getByLabel('Select aircraft')
  await select.selectOption({ label: (await select.locator('option', { hasText: registration }).textContent())!.trim() })
})

When('the pilot sets temperature {string} °C in Flight Prep', async ({ page }, temperature: string) => {
  await page.getByLabel('Temperature (°C)', { exact: true }).fill(temperature)
})
