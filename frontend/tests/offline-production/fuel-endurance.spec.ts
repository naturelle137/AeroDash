import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// All numbers below are synthetic arithmetic inputs, not POH/AFM data.
test('persisted fleet tank inputs feed the session-only fuel plan online and cached offline', async ({
  page,
  context,
}, info) => {
  // These checks cover session-only entries; the saved draft is covered by flight-prep-draft.spec.ts.
  await page.addInitScript(() => localStorage.removeItem('aerodash:flightprep:draft'))
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
    ['00000000-0000-4000-a000-000000000529', 'D-LOOK'],
    ['00000000-0000-4000-a000-000000000530', 'D-BADT'],
    ['00000000-0000-4000-a000-000000000531', 'D-LOOK2'],
  ]) {
    profile.id = id!
    profile.registration = registration!
    if (registration === 'D-MULTI') {
      profile.weighingReports[0]!.emptyCg = 1080 / 560
      profile.loadPoints[0]!.defaultQuantity = 30
      profile.loadPoints.push({
        ...structuredClone(profile.loadPoints[0]!),
        name: 'Synthetic B',
        arm: 3,
      })
      profile.loadPoints.forEach((tank, i) => {
        tank.fuelTank!.burnSequences = [
          { sequenceName: 'A first', ordinalPosition: i + 1 },
          { sequenceName: 'B first', ordinalPosition: 2 - i },
        ]
      })
    }
    if (registration === 'D-VARY') {
      profile.loadPoints = [profile.loadPoints[0]!]
      profile.weighingReports[0]!.emptyCg = 2
      profile.loadPoints[0]!.defaultQuantity = 50
      profile.loadPoints[0]!.fuelTank!.burnSequences = []
      profile.loadPoints[0]!.arm = null
      profile.loadPoints[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 10, moment: 10 },
        { massOrVolume: 30, moment: 60 },
        { massOrVolume: 50, moment: 150 },
      ]
    }
    if (registration!.startsWith('D-LOOK') || registration === 'D-BADT') {
      // Synthetic nonlinear total-moment table (kg, kg·m), zero unusable fuel.
      profile.loadPoints = [structuredClone(profile.loadPoints[0]!)]
      profile.loadPoints[0]!.fuelTank!.unusableFuel = 0
      profile.loadPoints[0]!.armLookup =
        registration === 'D-BADT'
          ? [
              { massOrVolume: 10, moment: 10 },
              { massOrVolume: 50, moment: 150 },
            ]
          : [
              { massOrVolume: 0, moment: 0 },
              { massOrVolume: 10, moment: 10 },
              { massOrVolume: 30, moment: 60 },
              { massOrVolume: 50, moment: 150 },
            ]
      if (registration === 'D-LOOK2')
        profile.loadPoints.push({
          ...structuredClone(profile.loadPoints[0]!),
          name: 'Synthetic B',
          arm: 3,
          armLookup: [],
          defaultQuantity: 0,
        })
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
    'Usable fuel ⓘ: 40 kg. Excluded unusable fuel: 10 kg.',
    { useInnerText: true },
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
  const fuelNotice = page.locator('.state-banner .notification').filter({ hasText: 'Insufficient fuel for the entered trip plus reserve.' })
  await expect(fuelNotice).toHaveCount(0)
  await expect(arrival.locator('dd:not([data-testid="arrival-cg"])')).toHaveText([
    '600 kg',
    '40 kg',
    '560 kg',
    '0 kg',
  ])
  await expect(card.getByTestId('arrival-cg')).toHaveText('2 m')
  await reserve.fill('1')
  await expect(results).toContainText('WARN-FE-001')
  await expect(fuelNotice).toHaveCount(1)
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
  await expect(fuelNotice).toHaveCount(0)
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
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click()
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
  await expect(method).toHaveValue('direct')
  await expect(direct).toHaveValue('')
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
  await expect(card.getByTestId('trip-path')).toContainText('Outside envelope')
  await card.getByTestId('trip-path').scrollIntoViewIfNeeded()
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
  for (const registration of ['D-VARY']) {
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
      await expect(card.getByTestId('arrival-cg')).toHaveText('2.017 m')
      await expect(card.getByTestId('trip-path')).toContainText('Outside envelope')
    }
    await card.getByTestId('trip-path').scrollIntoViewIfNeeded()
    const imagePath = info.outputPath(`${registration}-arrival-offline.png`)
    await page.screenshot({ path: imagePath })
    await info.attach(`${registration}-arrival-offline`, {
      path: imagePath,
      contentType: 'image/png',
    })
  }
  const multi = picker.locator('option').filter({ hasText: 'D-MULTI' }).first()
  await picker.selectOption((await multi.getAttribute('value'))!)
  const sequence = card.getByLabel('Arrival CG burn sequence')
  for (const planning of ['duration', 'direct']) {
    await method.selectOption(planning)
    if (planning === 'duration') {
      await rate.fill('30')
      await trip.fill('60')
      await reserve.fill('10')
    } else await direct.fill('30')
    await expect(sequence).toHaveValue('')
    await expect(arrival).toContainText('570 kg')
    await expect(arrival).toContainText('Choose an explicit named burn sequence')
    await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
    if (planning === 'direct') {
      for (const [label, target] of [
        ['unselected', arrival],
        ['controls', sequence],
      ] as const) {
        await target.evaluate((element) => element.scrollIntoView({ block: 'center' }))
        const path = info.outputPath(`multi-${label}.png`)
        await page.screenshot({ path })
        await info.attach(`multi-${label}`, { path, contentType: 'image/png' })
      }
    }
    for (const [name, cg] of [
      ['A first', '1.947 m'],
      ['B first', '1.912 m'],
    ]) {
      await sequence.selectOption(name!)
      await expect(card.getByTestId('arrival-cg')).toHaveText(cg!)
      await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      const path = info.outputPath(`multi-${planning}-${name!.charAt(0)}.png`)
      await page.screenshot({ path })
      await info.attach(`multi-${planning}-${name}`, { path, contentType: 'image/png' })
    }
    await tank.fill('40')
    await tank.blur()
    await expect(card.getByTestId('arrival-cg')).toHaveText('1.897 m')
    await tank.fill('30')
    await tank.blur()
    await expect(card.getByTestId('arrival-cg')).toHaveText('1.912 m')
  }
  await category.selectOption('Utility')
  await expect(arrival).toHaveCount(0)
  await category.selectOption('Normal')
  await expect(sequence).toHaveValue('')
  await expect(arrival).toContainText('570 kg')
  await sequence.selectOption('A first')
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.947 m')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = localStorage.getItem('aerodash:session:payload')
        return saved ? JSON.parse(saved).aircraftId : null
      }),
    )
    .toBe(await multi.getAttribute('value'))
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(picker.locator('option:checked')).toContainText('D-MULTI')
  await expect(method).toHaveValue('')
  await expect(sequence).toHaveValue('')
  await expect(arrival).toHaveCount(0)
  await method.selectOption('direct')
  await expect(direct).toHaveValue('')
  await direct.fill('30')
  await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
  await sequence.selectOption('B first')
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.912 m')
  await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: info.outputPath('multi-reset-offline.png') })
  await info.attach('multi-reset-offline', {
    path: info.outputPath('multi-reset-offline.png'),
    contentType: 'image/png',
  })
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)

  // Single lookup tank with zero unusable fuel, still cached offline.
  // Blocked M&B has no arrival region; centre the visible validation error instead.
  async function blockedShot(name: string) {
    const error = page.getByRole('alert').filter({ hasText: 'Invalid input: Synthetic tank' })
    await error.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: info.outputPath(`${name}.png`) })
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' })
  }
  async function choose(registration: string) {
    const entry = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await entry.getAttribute('value'))!)
    await tank.fill('50')
    await tank.blur()
  }
  async function shot(name: string) {
    await arrival.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    const path = info.outputPath(`${name}.png`)
    await page.screenshot({ path })
    await info.attach(name, { path, contentType: 'image/png' })
  }
  const masses = () => arrival.locator('dd:not([data-testid="arrival-cg"])')
  await choose('D-LOOK')
  await expect(method).toHaveValue('')
  await method.selectOption('duration')
  await rate.fill('10')
  await trip.fill('60')
  await reserve.fill('30')
  // (1270 − (150 − 105)) / 600 kg·m/kg
  await expect(masses()).toHaveText(['610 kg', '10 kg', '600 kg', '40 kg'])
  await expect(card.getByTestId('arrival-cg')).toHaveText('2.042 m')
  await expect(arrival).toContainText('covers the current load')
  await expect(results).toContainText('table moment at the takeoff load minus the table moment')
  await expect(page.getByRole('alert').filter({ hasText: 'CG Out of Envelope' })).toBeVisible()
  await shot('lookup-duration-partial-offline')
  await trip.fill('0')
  await expect(card.getByTestId('arrival-cg')).toHaveText('2.082 m')
  await trip.fill('300')
  await reserve.fill('0')
  await expect(masses()).toHaveText(['610 kg', '50 kg', '560 kg', '0 kg'])
  await expect(card.getByTestId('arrival-cg')).toHaveText('2 m')
  await expect(results).toContainText('Zero margin')
  await method.selectOption('direct')
  await expect(direct).toHaveValue('')
  await expect(arrival).toHaveCount(0)
  for (const [burn, cg] of [
    ['0', '2.082 m'],
    ['50', '2 m'],
    ['30', '1.991 m'],
  ]) {
    await direct.fill(burn!)
    await expect(card.getByTestId('arrival-cg')).toHaveText(cg!)
  }
  await shot('lookup-direct-partial-offline')
  // A load beyond the table now blocks M&B itself, so no arrival mass or CG remains.
  await tank.fill('60')
  await tank.blur()
  await expect(
    page.getByRole('alert').filter({ hasText: /Invalid input: Synthetic tank \(LOOKUP_OUT_OF_RANGE\)/ }),
  ).toBeVisible()
  await expect(arrival).toHaveCount(0)
  await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
  await expect(card).toContainText('Valid current Mass & Balance loading is required')
  await blockedShot('lookup-out-of-range-offline')
  await tank.fill('50')
  await tank.blur()
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.991 m')
  await category.selectOption('Utility')
  await expect(arrival).toHaveCount(0)
  await expect(card).toContainText('No fuel tanks available in this category')
  await category.selectOption('Normal')
  await expect(card.getByTestId('arrival-cg')).toHaveText('1.991 m')
  // A table that does not cover u = 0 blocks M&B (no invented origin) and thus arrival.
  await choose('D-BADT')
  await expect(
    page.getByRole('alert').filter({ hasText: /Invalid input: Synthetic tank \(LOOKUP_OUT_OF_RANGE\)/ }),
  ).toBeVisible()
  await method.selectOption('direct')
  await direct.fill('10')
  await expect(arrival).toHaveCount(0)
  await expect(card).toContainText('Valid current Mass & Balance loading is required')
  await blockedShot('D-BADT-lookup-blocked-offline')
  for (const [registration, reason, mass] of [
    ['D-LOOK2', 'explicit named burn sequence', '600 kg'],
  ]) {
    await choose(registration!)
    await expect(method).toHaveValue('')
    for (const planning of ['duration', 'direct']) {
      await method.selectOption(planning)
      if (planning === 'duration') {
        await rate.fill('10')
        await trip.fill('60')
        await reserve.fill('30')
      } else await direct.fill('10')
      await expect(arrival).toContainText(mass!)
      await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
      await expect(arrival).toContainText(reason!)
    }
    await shot(`${registration}-lookup-unsupported-offline`)
  }
  await choose('D-VARY')
  await method.selectOption('direct')
  await direct.fill('10')
  await expect(arrival).toContainText('590 kg')
  await expect(card.getByTestId('arrival-cg')).toHaveText('2.059 m')
  await shot('lookup-unusable-offline')
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await choose('D-LOOK')
  await expect(method).toHaveValue('')
  await method.selectOption('direct')
  await direct.fill('10')
  await expect(card.getByTestId('arrival-cg')).toHaveText('2.042 m')
  await shot('lookup-reload-offline')
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
})
