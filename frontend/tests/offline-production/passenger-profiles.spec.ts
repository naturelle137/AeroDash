import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('imported passenger profiles copy only into the selected occupant station', async ({ page }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  const base = testPohAircraft()
  base.loadPoints = [
    { name: 'Pilot', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 300, defaultQuantity: 0, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Passenger', kind: 'occupant', occupancy: 'optional', arm: 1, armLookup: [], operationalLimit: 300, defaultQuantity: 0, unit: 'lb', allowableCategories: null, fuelTank: null },
    { name: 'Baggage', kind: 'baggage', arm: 1, armLookup: [], operationalLimit: 300, defaultQuantity: 0, unit: 'kg', allowableCategories: null, fuelTank: null },
  ]
  base.performanceProfiles = []
  const profiles = [
    { ...base, registration: 'D-PROA', passengerProfiles: [{ name: 'Adult', standardWeight: 100, unit: 'lbs' }, { name: 'Child', standardWeight: 45.359237, unit: 'kg' }] },
    { ...base, id: '00000000-0000-4000-a000-000000000429', registration: 'D-PROB', passengerProfiles: [] },
  ]
  for (const profile of profiles) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
    await expect(page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true })).toBeVisible()
  }
  await page.goto('/mass-balance')
  const aircraft = page.getByLabel('Select aircraft', { exact: true })
  async function pick(registration: string) {
    await aircraft.selectOption((await aircraft.locator('option').filter({ hasText: registration }).first().getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  await pick('D-PROA')
  const pilot = page.locator('#station-0')
  const passenger = page.locator('#station-1')
  await page.getByLabel('Passenger profile for Pilot').selectOption('0')
  await expect.poll(async () => Number(await pilot.inputValue())).toBeCloseTo(45.359237)
  await expect(passenger).toHaveValue('0')
  await page.getByLabel('Passenger profile for Passenger').selectOption('1')
  await expect.poll(async () => Number(await passenger.inputValue())).toBeCloseTo(100)
  await expect(page.getByLabel('Passenger profile for Baggage')).toHaveCount(0)
  await pilot.fill('70')
  await pilot.blur()
  await expect(pilot).toHaveValue('70')
  await page.screenshot({ path: info.outputPath('passenger-profiles.png'), fullPage: true })
  await info.attach('passenger-profiles', { path: info.outputPath('passenger-profiles.png'), contentType: 'image/png' })
  await pick('D-PROB')
  await expect(page.getByLabel('Passenger profile for Pilot')).toHaveCount(0)
  await expect(pilot).toHaveValue('0')
})
