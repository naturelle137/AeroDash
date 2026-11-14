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
  profile.weighingReports[0]!.bem = 560
  profile.weighingReports[0]!.emptyCg = 2
  profile.certificationCategories.push({
    ...profile.certificationCategories[0]!,
    category: 'Utility',
  })
  profile.loadPoints = [
    {
      name: 'Synthetic tank',
      kind: 'fuel',
      arm: 1,
      armLookup: [],
      operationalLimit: 100,
      defaultQuantity: 10,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    },
  ]
  for (const [id, registration] of [
    [profile.id, 'D-TEST'],
    ['00000000-0000-4000-a000-000000000429', 'D-NEXT'],
    ['00000000-0000-4000-a000-000000000430', 'D-MULTI'],
    ['00000000-0000-4000-a000-000000000431', 'D-VARY'],
  ]) {
    profile.id = id!
    profile.registration = registration!
    if (registration === 'D-MULTI') {
      profile.loadPoints[0]!.defaultQuantity = 50
      profile.loadPoints.push({
        ...structuredClone(profile.loadPoints[0]!),
        name: 'Empty available tank',
        defaultQuantity: 10,
      })
    }
    if (registration === 'D-VARY') {
      profile.loadPoints = [profile.loadPoints[0]!]
      profile.loadPoints[0]!.arm = null
      profile.loadPoints[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 100 },
      ]
    }
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
  const arrival = page.getByRole('region', { name: 'Estimated trip arrival', exact: true })
  await expect(card.getByTestId('usable-fuel')).toHaveText(
    'Usable fuel: 40 kg. Excluded unusable fuel: 10 kg.',
  )
  await card.getByLabel('Planning method').selectOption('duration')
  await rate.fill('10')
  await trip.fill('120')
  await reserve.fill('30')
  await expect(results.locator(':scope > dl > dd')).toHaveText([
    '240 min',
    '20 kg',
    '5 kg',
    '25 kg',
    '15 kg',
  ])
  await expect(
    page
      .getByRole('region', { name: 'Estimated trip arrival', exact: true })
      .locator('dd:not([data-testid="arrival-cg"])'),
  ).toHaveText(['600 kg', '20 kg', '580 kg', '20 kg'])
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.966 m')
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('fuel-plan.png') })
  await info.attach('fuel-plan', {
    path: info.outputPath('fuel-plan.png'),
    contentType: 'image/png',
  })
  await trip.fill('0')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '0 kg',
    '600 kg',
    '40 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.933 m')
  await trip.fill('240')
  await reserve.fill('0')
  await expect(results).toContainText('Zero margin')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '40 kg',
    '560 kg',
    '0 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('2 m')
  await reserve.fill('1')
  await expect(results).toContainText('WARN-FE-001')
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('fuel-shortfall.png') })
  await info.attach('fuel-shortfall', {
    path: info.outputPath('fuel-shortfall.png'),
    contentType: 'image/png',
  })
  await trip.fill('241')
  await expect(arrival).toHaveCount(0)
  await expect(results).toContainText('Trip fuel exceeds available usable fuel')
  await trip.fill('120')
  await reserve.fill('180')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '20 kg',
    '580 kg',
    '20 kg',
  ])
  await expect(results).toContainText('WARN-FE-001')
  await tank.fill('60')
  await tank.blur()
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '610 kg',
    '20 kg',
    '590 kg',
    '30 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.949 m')
  await tank.fill('50')
  await tank.blur()
  await reserve.fill('30')
  await trip.fill('')
  await expect(results).toHaveCount(0)
  await trip.fill('120')
  await tank.fill('')
  await tank.blur()
  await expect(results).toHaveCount(0)
  await tank.fill('50')
  await tank.blur()
  await expect(results).toBeVisible()
  const method = card.getByLabel('Planning method')
  await method.selectOption('direct')
  const direct = card.getByLabel('Trip Fuel (kg)', { exact: true })
  await expect(arrival).toHaveCount(0)
  await expect(rate).toHaveCount(0)
  for (const invalid of ['', '-1', 'NaN', 'Infinity', '0x10', '1e2', '1kg', '9'.repeat(400)]) {
    await direct.fill(invalid)
    await expect(arrival).toHaveCount(0)
    await expect(card).toContainText('explicit finite nonnegative Trip Fuel')
  }
  await direct.fill('0')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '0 kg',
    '600 kg',
    '40 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.933 m')
  await direct.fill('40')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '40 kg',
    '560 kg',
    '0 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('2 m')
  await direct.fill('40.001')
  await expect(arrival).toHaveCount(0)
  await expect(card).toContainText('Trip fuel exceeds available usable fuel')
  await direct.fill('20')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '20 kg',
    '580 kg',
    '20 kg',
  ])
  for (const text of [
    'Total endurance',
    'Required reserve fuel',
    'WARN-FE-001',
    'Zero margin',
    'Margin =',
  ])
    await expect(card).not.toContainText(text)
  await tank.fill('60')
  await tank.blur()
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '610 kg',
    '20 kg',
    '590 kg',
    '30 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.949 m')
  await tank.fill('')
  await tank.blur()
  await expect(arrival).toHaveCount(0)
  await tank.fill('50')
  await tank.blur()
  await page.getByRole('button', { name: 'Reset Payload', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset', exact: true })
    .click()
  await expect(arrival).toHaveCount(0)
  await direct.fill('0')
  await expect(card.getByTestId('arrival-cg')).toHaveText('2 m')
  await tank.fill('50')
  await tank.blur()
  await direct.fill('20')
  const category = page.getByLabel('Certification category')
  await category.selectOption('Utility')
  await expect(arrival).toHaveCount(0)
  await expect(card).toContainText('No fuel tanks available in this category')
  await category.selectOption('Normal')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '20 kg',
    '580 kg',
    '20 kg',
  ])
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('direct-trip-fuel.png') })
  await info.attach('direct-trip-fuel', {
    path: info.outputPath('direct-trip-fuel.png'),
    contentType: 'image/png',
  })
  await direct.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('direct-controls.png') })
  await info.attach('direct-controls', {
    path: info.outputPath('direct-controls.png'),
    contentType: 'image/png',
  })
  await method.selectOption('duration')
  await expect(arrival).toHaveCount(0)
  await expect(rate).toHaveValue('')
  await method.selectOption('direct')
  await expect(direct).toHaveValue('')
  const other = picker.locator('option').filter({ hasText: 'D-NEXT' }).first()
  await picker.selectOption((await other.getAttribute('value'))!)
  await expect(results).toHaveCount(0)
  await picker.selectOption((await option.getAttribute('value'))!)
  await expect(method).toHaveValue('')
  await tank.fill('50')
  await tank.blur()
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem('aerodash:session:payload')?.includes('50') ?? false,
      ),
    )
    .toBe(true)
  await expect(page.getByRole('alert').filter({ hasText: 'CG Out of Envelope' })).toBeVisible()
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(method).toHaveValue('')
  await expect(results).toHaveCount(0)
  await method.selectOption('duration')
  await rate.fill('10')
  await trip.fill('120')
  await reserve.fill('30')
  await expect(results.locator(':scope > dl > dd')).toHaveText([
    '240 min',
    '20 kg',
    '5 kg',
    '25 kg',
    '15 kg',
  ])
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '20 kg',
    '580 kg',
    '20 kg',
  ])
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('fuel-offline.png') })
  await info.attach('fuel-offline', {
    path: info.outputPath('fuel-offline.png'),
    contentType: 'image/png',
  })
  await method.selectOption('direct')
  await expect(arrival).toHaveCount(0)
  await direct.fill('20')
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '20 kg',
    '580 kg',
    '20 kg',
  ])
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('direct-offline.png') })
  await info.attach('direct-offline', {
    path: info.outputPath('direct-offline.png'),
    contentType: 'image/png',
  })
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.966 m')
  await page.reload()
  await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
  await expect(method).toHaveValue('')
  await method.selectOption('direct')
  await expect(direct).toHaveValue('')
  await direct.fill('20')
  await expect(arrival).toBeVisible()
  await page.goto('/fleet')
  await page.goto('/mass-balance')
  await expect(method).toHaveValue('')
  await expect(arrival).toHaveCount(0)
  for (const [registration, reason] of [
    ['D-MULTI', 'Exactly one category-available'],
    ['D-VARY', 'Variable-arm tanks'],
  ]) {
    const unsupported = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await unsupported.getAttribute('value'))!)
    for (const planning of ['duration', 'direct']) {
      await method.selectOption(planning)
      if (planning === 'duration') {
        await rate.fill('10')
        await trip.fill('120')
        await reserve.fill('30')
      } else await direct.fill('20')
      await expect(arrival).toContainText('580 kg')
      await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
      await expect(arrival).toContainText(reason)
    }
    await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    const imagePath = info.outputPath(`${registration}-unsupported-offline.png`)
    await page.screenshot({ path: imagePath })
    await info.attach(`${registration}-unsupported-offline`, {
      path: imagePath,
      contentType: 'image/png',
    })
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
})
