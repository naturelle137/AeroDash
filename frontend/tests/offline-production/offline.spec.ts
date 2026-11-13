import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

const connectivity = (page: Page) => page.getByRole('banner').getByRole('status')
const distances = (page: Page) => page.getByRole('region', { name: 'Raw POH table distances', exact: true })
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: false })
  await info.attach(name, { path, contentType: 'image/png' })
}
async function selectProfile(page: Page) {
  const select = page.getByLabel('Aircraft profile', { exact: true })
  await expect(select.locator('option')).toHaveCount(2)
  await select.selectOption((await select.locator('option').nth(1).getAttribute('value'))!)
}
async function rawLookup(page: Page) {
  await page.getByLabel('Mass (kg)', { exact: true }).fill('900')
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await page.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Compute raw distances', exact: true }).click()
  await expect(distances(page).locator('dd')).toHaveText(['220.0 m', '320.0 m', '420.0 m', '520.0 m'])
}

test('cached preparation reopens offline with persisted synthetic data and live browser status', async ({ page, context }, info) => {
  await page.goto('/fleet')
  // Accept the real gate once; no init-script reinjection or service-worker bypass.
  await page.getByTestId('disclaimer-gate-accept').click()
  await expect(connectivity(page)).toHaveText('Browser online')
  await page.getByLabel('Browser connectivity details', { exact: true }).click()
  await expect(page.getByText(/Browser-reported connectivity only/)).toBeVisible()
  await capture(page, info, 'online-connectivity-details')
  await page.getByLabel('Browser connectivity details', { exact: true }).click()

  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  // Workbox's activated precache must actually contain the app document and scripts.
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.includes('precache'))
    const urls = (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url)))).flat()
    return { document: urls.some((url) => new URL(url).pathname === '/index.html'), scripts: urls.some((url) => url.includes('/assets/') && url.includes('.js')) }
  })
  expect(cached).toEqual({ document: true, scripts: true })

  const profile = testPohAircraft()
  profile.loadPoints = [{ name: 'Synthetic pilot', kind: 'occupant', occupancy: 'required', arm: 1,
    armLookup: [], operationalLimit: 150, defaultQuantity: 80, unit: 'kg', allowableCategories: null, fuelTank: null }]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-offline.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
  })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only - no real POH')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/performance')
  const runway = page.locator('form[aria-labelledby="manual-runway-heading"]')
  await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic offline field')
  await runway.getByLabel('Runway designator', { exact: true }).fill('09')
  await runway.getByLabel('TORA — takeoff run available', { exact: true }).fill('1000')
  await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('900')
  await runway.getByLabel('Field elevation', { exact: true }).fill('100')
  for (const label of ['TORA unit', 'LDA unit', 'Field elevation unit']) {
    await runway.getByLabel(label, { exact: true }).selectOption('m')
  }
  await runway.getByLabel('Surface type', { exact: true }).selectOption({ label: 'Paved' })
  await runway.getByLabel('Surface condition', { exact: true }).selectOption({ label: 'Dry' })
  await runway.getByRole('button', { name: 'Save runway inputs', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Saved manual runway', exact: true })).toContainText('Synthetic offline field')

  await context.setOffline(true)
  await expect(connectivity(page)).toHaveText('Browser offline')
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await expect(connectivity(page)).toHaveText('Browser offline')
  const saved = page.getByRole('region', { name: 'Saved manual runway', exact: true })
  await expect(saved).toContainText('Synthetic offline field')
  await expect(saved).toContainText('User-entered, not airport-validated')
  await selectProfile(page)
  await rawLookup(page)
  await page.getByRole('button', { name: 'Assess correction sources', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Correction sources', exact: true })).toContainText('No wind, surface or slope correction can be applied')
  await distances(page).scrollIntoViewIfNeeded()
  await capture(page, info, 'offline-raw-distances')
  await page.getByLabel('Mass (kg)', { exact: true }).fill('901')
  await expect(distances(page)).toHaveCount(0)
  await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('850')
  await expect(saved).toHaveCount(0)
  await expect(runway).toContainText('Runway assessment unavailable')
  await page.reload()
  await expect(saved).toContainText('900')

  // Real navigations while disconnected also exercise cached lazy route chunks.
  await page.goto('/fleet')
  await expect(page.locator('.profile-item')).toContainText('D-TEST')
  await expect(connectivity(page)).toHaveText('Browser offline')
  await capture(page, info, 'offline-fleet')
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  const option = picker.locator('option').filter({ hasText: 'D-TEST' }).first()
  await picker.selectOption((await option.getAttribute('value'))!)
  const pilot = page.getByRole('textbox', { name: 'Synthetic pilot', exact: true })
  await pilot.fill('85')
  await expect(page.getByRole('region', { name: 'Calculation results', exact: true })).toContainText('585.0')
  // Session persistence is debounced; wait for the actual stored payload before reload.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aerodash:session:payload')?.includes('85') ?? false)).toBe(true)
  await page.reload()
  await expect(pilot).toHaveValue('85')
  await expect(page.getByRole('region', { name: 'Calculation results', exact: true })).toContainText('585.0')
  await capture(page, info, 'offline-mass-balance')
  await pilot.fill('')
  await expect(page.getByText('WITHIN LIMITS', { exact: true })).toHaveCount(0)
  await expect(connectivity(page)).toHaveText('Browser offline')
  await context.setOffline(false)
  await expect(connectivity(page)).toHaveText('Browser online')
  await capture(page, info, 'reconnected')
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
})
