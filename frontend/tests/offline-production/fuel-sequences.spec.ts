import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('named mixed tank sequences recompute the trip path offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 560
  profile.weighingReports[0]!.emptyCg = 1080 / 560
  profile.certificationCategories[0]!.envelope = [
    { mass: 500, armOrMoment: 0 }, { mass: 1200, armOrMoment: 0 },
    { mass: 1200, armOrMoment: 4 }, { mass: 500, armOrMoment: 4 },
  ]
  profile.loadPoints = [1, 3].map((arm, i) => ({
    name: `Synthetic tank ${i + 1}`, kind: 'fuel' as const, arm: i === 0 ? null : arm,
    armLookup: i === 0 ? [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 20, moment: 20 }, { massOrVolume: 30, moment: 30 }] : [],
    operationalLimit: 100, defaultQuantity: 30, unit: 'kg', allowableCategories: null,
    fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL' as const], burnSequences: [
      { sequenceName: 'A first', ordinalPosition: i + 1 },
      { sequenceName: 'B first', ordinalPosition: 2 - i },
    ] },
  }))
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-sequences.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic arithmetic only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: profile.registration }).first().getAttribute('value'))!)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await picker.selectOption((await picker.locator('option').filter({ hasText: profile.registration }).first().getAttribute('value'))!)
  const card = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  await card.getByLabel('Planning method').selectOption('direct')
  await card.getByLabel('Trip Fuel (kg)', { exact: true }).fill('30')
  await expect(card).toContainText('Choose an explicit named burn sequence')
  for (const [sequence, value] of [['A first', '1.947 m'], ['B first', '1.912 m'], ['A first', '1.947 m']]) {
    await card.getByLabel('Arrival CG burn sequence').selectOption(sequence!)
    await expect(card.getByTestId('arrival-cg')).toHaveText(value!)
    await expect(card.getByTestId('trip-path')).toContainText('Inside envelope')
    await expect(card.getByLabel('Trip Fuel (kg)', { exact: true })).toHaveValue('30')
  }
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: info.outputPath('fuel-sequences.png') })
  await info.attach('fuel-sequences', { path: info.outputPath('fuel-sequences.png'), contentType: 'image/png' })
})
