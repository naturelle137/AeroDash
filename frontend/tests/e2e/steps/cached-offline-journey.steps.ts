import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { Given, When, Then } = createBdd()

Given('the Flight Prep viewport is {int} by {int} and a synthetic aircraft is cached', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height })
  await page.goto('/fleet')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
})

When('the pilot reopens Flight Prep offline', async ({ page, context }) => {
  await context.setOffline(true)
  await page.goto('/mass-balance')
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).getAttribute('value'))!)
})

Then('online forecast data is unavailable', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Time-specific forecast' }).getByRole('status')).toContainText('Browser offline')
})

When('the pilot prepares mass, fuel and manual runway performance offline', async ({ page }) => {
  for (const [name, value] of [['Synthetic payload', '100'], ['Synthetic tank', '50']]) {
    const input = page.getByRole('textbox', { name, exact: true })
    await input.fill(value!)
    await input.blur()
  }
  const results = page.getByRole('region', { name: 'Calculation results' })
  await expect(results.locator('dt', { hasText: 'Takeoff Mass' }).locator('xpath=following-sibling::dd[1]')).toContainText('900.0')
  await expect(results.locator('dt', { hasText: 'Zero Fuel Mass' }).locator('xpath=following-sibling::dd[1]')).toContainText('850.0')
  const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  await fuel.getByLabel('Planning method').selectOption('direct')
  await fuel.getByLabel('Trip Fuel (kg)').fill('20')
  const arrival = (label: string) => fuel.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]')
  await expect(arrival('Takeoff mass')).toHaveText('900 kg')
  await expect(arrival('Trip fuel burned')).toHaveText('20 kg')
  await expect(arrival('Estimated arrival mass')).toHaveText('880 kg')
  await expect(arrival('Usable fuel remaining on arrival')).toHaveText('30 kg')
  const performance = page.getByRole('region', { name: 'Performance', exact: true })
  const runway = performance.getByRole('form', { name: 'Manual runway', exact: true })
  await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic field')
  await runway.getByLabel('Runway designator', { exact: true }).fill('18')
  await runway.getByLabel('TORA — takeoff run available', { exact: true }).fill('1000')
  await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('900')
  await runway.getByLabel('Field elevation', { exact: true }).fill('1000')
  await runway.getByLabel('Surface type', { exact: true }).selectOption('paved')
  await runway.getByLabel('Surface condition', { exact: true }).selectOption('dry')
  await runway.getByRole('button', { name: 'Save runway inputs', exact: true }).click()
  await performance.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await performance.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await performance.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  await expect(performance.getByRole('group', { name: 'Takeoff raw distances' }).locator('dd')).toHaveText(['220.0 m', '320.0 m'])
  await expect(performance.getByRole('group', { name: 'Landing raw distances' }).locator('dd')).toHaveText(['400.0 m', '500.0 m'])
})

Then('the briefing preview contains the offline preparation', async ({ page }) => {
  await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  await expect(preview.getByRole('heading', { name: 'M&B results' })).toBeVisible()
  await expect(preview.getByRole('heading', { name: 'Current fuel plan and estimated trip arrival' })).toBeVisible()
  await expect(preview.getByRole('row', { name: 'Takeoff 900.0 kg 1.000 m MTOM' })).toBeVisible()
  await expect(preview.getByRole('row', { name: 'Zero fuel 850.0 kg' })).toBeVisible()
  await expect(preview.locator('tr', { hasText: 'Trip fuel burned' })).toContainText('20 kg')
  await expect(preview.locator('tr', { hasText: 'Estimated arrival mass' })).toContainText('880 kg')
  await expect(preview).toContainText('Synthetic field')
  await expect(preview).toContainText('220.0 m')
  await expect(preview).toContainText('400.0 m')
})

Then('offline journey evidence is captured at {int} pixels', async ({ page, $testInfo }, width: number) => {
  await $testInfo.attach(`offline-journey-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
