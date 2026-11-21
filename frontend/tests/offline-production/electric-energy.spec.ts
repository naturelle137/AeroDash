import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('manual electric budget and briefing use current synthetic inputs', async ({ page }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  const profile = testPohAircraft()
  profile.powertrain = 'electric'
  profile.batteryPack = { usableEnergyKwh: 30, reserveFloorKwh: 5 }
  profile.loadPoints = []
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-electric.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic arithmetic only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: profile.registration }).first().getAttribute('value'))!)
  const card = page.getByRole('region', { name: 'Energy & Endurance' })
  await card.getByLabel('Current available energy (kWh)').fill('20')
  await card.getByLabel('Average consumption (kW)').fill('20')
  await card.getByLabel('Planned trip duration (min)').fill('60')
  await expect(card.getByRole('alert')).toContainText('below the reserve floor')
  await expect(card).toContainText('-5 kWh')
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('electric-energy.png') })
  await info.attach('electric-energy', { path: info.outputPath('electric-energy.png'), contentType: 'image/png' })
  await card.getByLabel('Current available energy (kWh)').fill('31')
  await expect(card).toContainText('Energy budget unavailable')
  await expect(card.getByLabel('Estimated energy budget')).toHaveCount(0)
})
