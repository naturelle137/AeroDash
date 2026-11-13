import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// All numbers below are synthetic arithmetic inputs, not POH/AFM data.
test('persisted fleet tank inputs feed the session-only fuel plan online and cached offline', async ({
  page,
  context,
}, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
  const profile = testPohAircraft()
  profile.loadPoints = [
    {
      name: 'Synthetic tank',
      kind: 'fuel',
      arm: 1,
      armLookup: [],
      operationalLimit: 100,
      defaultQuantity: 10,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    },
  ]
  for (const [id, registration] of [
    [profile.id, 'D-TEST'],
    ['00000000-0000-4000-a000-000000000429', 'D-NEXT'],
  ]) {
    profile.id = id!
    profile.registration = registration!
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-fuel.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Verifier initials').fill('TS')
    await dialog.getByLabel('POH revision').fill('Synthetic arithmetic only')
    await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(dialog).toBeHidden()
  }
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  const option = picker.locator('option').filter({ hasText: 'D-TEST' }).first()
  await picker.selectOption((await option.getAttribute('value'))!)
  const tank = page.getByRole('textbox', { name: 'Synthetic tank', exact: true })
  await tank.fill('50')
  await tank.blur()
  const card = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  const rate = card.getByLabel('Planned average consumption (kg/h)')
  const trip = card.getByLabel('Planned flight duration (min)')
  const reserve = card.getByLabel('Reserve duration (min)')
  const results = page.getByRole('region', { name: 'Fuel planning results' })
  await expect(card.getByTestId('usable-fuel')).toHaveText(
    'Usable fuel: 40 kg. Excluded unusable fuel: 10 kg.',
  )
  await rate.fill('10')
  await trip.fill('120')
  await reserve.fill('30')
  await expect(results.locator('dd')).toHaveText(['240 min', '20 kg', '5 kg', '25 kg', '15 kg'])
  await results.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('fuel-plan.png') })
  await info.attach('fuel-plan', {
    path: info.outputPath('fuel-plan.png'),
    contentType: 'image/png',
  })
  await trip.fill('240')
  await reserve.fill('0')
  await expect(results).toContainText('Zero margin')
  await reserve.fill('1')
  await expect(results).toContainText('WARN-FE-001')
  await results.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('fuel-shortfall.png') })
  await info.attach('fuel-shortfall', {
    path: info.outputPath('fuel-shortfall.png'),
    contentType: 'image/png',
  })
  await trip.fill('')
  await expect(results).toHaveCount(0)
  await trip.fill('120')
  await tank.fill('')
  await tank.blur()
  await expect(results).toHaveCount(0)
  await tank.fill('50')
  await tank.blur()
  await expect(results).toBeVisible()
  const other = picker.locator('option').filter({ hasText: 'D-NEXT' }).first()
  await picker.selectOption((await other.getAttribute('value'))!)
  await expect(results).toHaveCount(0)
  await picker.selectOption((await option.getAttribute('value'))!)
  await expect(rate).toHaveValue('')
  await tank.fill('50')
  await tank.blur()
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem('aerodash:session:payload')?.includes('50') ?? false,
      ),
    )
    .toBe(true)
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(rate).toHaveValue('')
  await expect(results).toHaveCount(0)
  await rate.fill('10')
  await trip.fill('120')
  await reserve.fill('30')
  await expect(results.locator('dd')).toHaveText(['240 min', '20 kg', '5 kg', '25 kg', '15 kg'])
  await results.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('fuel-offline.png') })
  await info.attach('fuel-offline', {
    path: info.outputPath('fuel-offline.png'),
    contentType: 'image/png',
  })
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
})
