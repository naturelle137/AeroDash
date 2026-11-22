import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('imported table points can all be inspected before explicit verification', async ({ page }, info) => {
  const profile = testPohAircraft()
  profile.performanceProfiles = profile.performanceProfiles!.slice(0, 2)
  for (const table of profile.performanceProfiles) {
    table.sourceUnits = { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' }
    table.sourceReference = 'Synthetic test data only'
    table.dataPoints = [
      { mass: 2000, pressureAltitude: 304.8, temperature: 50, distance: 1000 },
      { mass: 1, pressureAltitude: -30.48, temperature: -40, distance: 1 },
    ]
  }
  await page.goto('/')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.goto('/fleet')
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
  })
  const item = page.getByRole('listitem').filter({ hasText: 'D-TEST' })
  await expect(item).toContainText('Draft')
  await item.getByText('Review imported performance tables').click()
  for (const table of profile.performanceProfiles) {
    await item.getByText(`${table.flightPhase} — 2 points`).click()
    const section = item.locator('details').filter({ has: page.getByText(`${table.flightPhase} — 2 points`, { exact: true }) }).last()
    await expect(section).toContainText('Declared source units: lb / m / °F / ft')
    await expect(section).toContainText('Synthetic test data only')
    const source = section.getByRole('table', { name: 'Original source values' })
    const normalized = section.getByRole('table', { name: 'Normalized lookup values' })
    await expect(source.locator('tbody tr')).toHaveCount(2)
    await expect(normalized.locator('tbody tr')).toHaveCount(2)
    await expect(source.locator('tbody tr').nth(0)).toHaveText(/1\s*2000\s*304\.8\s*50\s*1000/)
    await expect(source.locator('tbody tr').nth(1)).toHaveText(/2\s*1\s*-30\.48\s*-40\s*1/)
    await expect(normalized.locator('tbody tr').nth(0)).toHaveText(/1\s*907\.18474\s*1000\s*10\s*304\.8/)
    await expect(normalized.locator('tbody tr').nth(1)).toHaveText(/2\s*0\.45359237\s*-100\s*-40\s*0\.3048/)
    await expect(section.locator('input, button, select, textarea')).toHaveCount(0)
  }
  await expect(item).toContainText('Draft')
  await expect(item.getByRole('button', { name: 'Verify D-TEST' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('fleet-table-review.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'D-TEST' })).toContainText('Draft')
})
