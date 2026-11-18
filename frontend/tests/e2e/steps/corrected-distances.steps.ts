import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { When, Then } = createBdd()
const takeoff = (page: Page) => page.getByRole('region', { name: 'Takeoff corrected distances', exact: true })

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
  await expect(region).toContainText('Supplement S9')
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
