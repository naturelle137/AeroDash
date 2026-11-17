import { expect, test, type Page } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic software reference vectors only. Awaiting the published Verified UI is
// diagnostic isolation of the separately owned Fleet completion race, not Draft acceptance.
async function importReviewed(page: Page, profile: ReturnType<typeof testPohAircraft>) {
  await page.goto('/fleet')
  const gate = page.getByTestId('disclaimer-gate-accept')
  if (await gate.isVisible()) await gate.click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'qa-synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('QA')
  await dialog.getByLabel('POH revision').fill('Synthetic software vectors only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: profile.registration }).getByText(/Verified by QA/)).toBeVisible()
}

for (const variant of ['kg', 'converted', 'distant-decrease', 'phase-envelope'] as const) {
  test(`integrated independent lookup reference vectors ${variant}`, async ({ page, context }, info) => {
    const profile = testPohAircraft()
    if (variant === 'converted') for (const table of profile.performanceProfiles) {
      table.sourceUnits = { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' }
      for (const point of table.dataPoints) {
        point.mass /= 0.45359237; point.pressureAltitude *= 0.3048
        point.temperature = point.temperature * 1.8 + 32; point.distance /= 0.3048
      }
    }
    if (variant === 'distant-decrease') {
      const point = profile.performanceProfiles[0]!.dataPoints.find(p => p.mass === 1000 && p.pressureAltitude === 2000 && p.temperature === 20)!
      point.distance = 1
    }
    if (variant === 'phase-envelope') for (const table of profile.performanceProfiles.slice(2)) {
      for (const point of table.dataPoints) point.mass += 200
    }
    await importReviewed(page, profile)
    await page.goto('/performance')
    const picker = page.getByLabel('Aircraft profile', { exact: true })
    await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
    const mass = page.getByLabel('Mass (kg)', { exact: true })
    const pa = page.getByLabel('Pressure altitude (ft)', { exact: true })
    const temperature = page.getByLabel('Temperature (°C)', { exact: true })
    const takeoff = page.getByRole('group', { name: 'Takeoff raw distances' })
    const landing = page.getByRole('group', { name: 'Landing raw distances' })
    await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
    await pa.fill('1000'); await temperature.fill('10')
    for (const offline of [false, true]) {
      if (offline) {
        await context.setOffline(true)
        expect((await page.reload())?.fromServiceWorker()).toBe(true)
        await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
        await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
        await pa.fill('1000'); await temperature.fill('10')
      }
      await mass.fill('900');
      if (variant !== 'distant-decrease') await expect(takeoff.locator('dd').first()).toHaveText('220.0 m')
      if (variant === 'phase-envelope') {
        await expect(landing).not.toContainText('capped at the documented')
        await expect(landing.locator('dd').first()).toContainText('320.0 m')
        await mass.fill('1100');
        await expect(takeoff).toContainText('above the table maximum')
        await expect(landing.locator('dd')).toHaveText(['420.0 m', '520.0 m'])
      }
      if (variant === 'kg' || variant === 'converted') {
        for (const [m, expected] of [['800', '120.0 m'], ['1000', '320.0 m'], ['750', '120.0 m']]) {
          await mass.fill(m!); await expect(takeoff.locator('dd').first()).toContainText(expected!)
        }
        for (const invalid of ['1000.001', '1100', '0', '-1', 'NaN', 'Infinity', '-Infinity']) {
          await mass.fill(invalid); await expect(takeoff.locator('dd')).toHaveCount(0)
        }
        await mass.fill('900')
        for (const invalid of ['-0.001', '2000.001', 'NaN', 'Infinity']) {
          await pa.fill(invalid); await expect(takeoff.locator('dd')).toHaveCount(0)
        }
        await pa.fill('1000')
        for (const invalid of ['-0.001', '20.001', 'NaN', 'Infinity']) {
          await temperature.fill(invalid); await expect(takeoff.locator('dd')).toHaveCount(0)
        }
        await temperature.fill('10');
      }
      if (variant === 'distant-decrease') {
        await mass.fill('750'); await pa.fill('0'); await temperature.fill('0');
        await expect(takeoff).toContainText('table decreases with mass somewhere'); await expect(takeoff.locator('dd')).toHaveCount(0)
        await expect(landing.locator('dd')).toHaveCount(2)
      }
      await page.screenshot({ path: info.outputPath(`${variant}-${offline ? 'offline' : 'online'}.png`), fullPage: true })
    }
  })
}

test('integrated same-turn native print invalidates every current input family', async ({ page }, info) => {
  const profile = testPohAircraft(); profile.weighingReports[0]!.bem = 750
  profile.certificationCategories.push({ ...profile.certificationCategories[0]!, category: 'Utility' })
  profile.loadPoints = [
    { name: 'QA payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'QA fuel', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await importReviewed(page, profile)
  const alternate = structuredClone(profile); alternate.id = '00000000-0000-4000-a000-000000000999'; alternate.registration = 'D-NEXT'
  await importReviewed(page, alternate)
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  await page.getByLabel('Planning method').selectOption('direct')
  await page.getByLabel('Trip Fuel (kg)', { exact: true }).fill('20')
  await perf.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await perf.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  const cases = [
    ['#station-0', '101', 'input'], ['#station-1', '49', 'input'],
    ['#fe-direct-trip', '21', 'input'], ['#fe-method', 'duration', 'change'],
    ['#manual-runway-designator', '19', 'input'], ['#pa-direct', '1001', 'input'], ['#performance-temperature', '11', 'input'],
    ['#category-select', 'Utility', 'change'], ['#unit-pref-elevation', 'm', 'change'], ['#unit-pref-runway', 'ft', 'change'],
  ]
  const results = []
  for (const [selector, value, event] of cases) {
    const target = page.locator(selector!)
    // Missing selectors are a test failure, never silently skipped.
    await expect(target).toHaveCount(1)

    await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
    const guarded = await target.evaluate((input: HTMLInputElement | HTMLSelectElement, data) => {
      input.value = data.value!; input.dispatchEvent(new Event(data.event!, { bubbles: true })); window.print()
      return document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')
    }, { value, event })
    results.push({ selector, guarded }); expect(guarded).toBe('true')
    await expect(preview).toContainText('Preview invalidated')
    await page.keyboard.press('Escape')
  }

  await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
  const profileGuard = await picker.evaluate((input: HTMLSelectElement) => {
    input.value = [...input.options].find(o => o.text.includes('D-NEXT'))!.value
    input.dispatchEvent(new Event('change', { bubbles: true })); window.print()
    return document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')
  })
  expect(profileGuard).toBe('true'); results.push({ selector: 'profile', guarded: profileGuard })
  await expect(preview).toContainText('Preview invalidated'); await page.keyboard.press('Escape')
  const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
  const geometry = []
  for (const fraction of [0, .5, 1]) {
    await page.evaluate(f => window.scrollTo(0, document.documentElement.scrollHeight * f), fraction)
    await expect(action).toBeInViewport()
    const button = (await action.boundingBox())!
    const navigation = await page.locator('.app-bottom-nav').boundingBox()
    expect(button.y + button.height).toBeLessThanOrEqual(navigation?.y ?? page.viewportSize()!.height)
    geometry.push({ fraction, button, navigation, viewport: page.viewportSize() })
  }
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  let reached = false
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab')
    if (await action.evaluate(el => el === document.activeElement)) { reached = true; break }
  }
  expect(reached).toBe(true)
  await page.keyboard.press('Enter'); await expect(preview).toBeVisible(); await page.keyboard.press('Escape')
  await info.attach('action-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
  await info.attach('native-guard-results', { body: JSON.stringify(results), contentType: 'application/json' })
})

test('integrated direct-derived equivalence and expired verification remain explicit', async ({ page, context }, info) => {
  await importReviewed(page, testPohAircraft())
  await page.goto('/performance')
  const picker = page.getByLabel('Aircraft profile', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  await page.getByLabel('Mass (kg)', { exact: true }).fill('900')
  await page.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await page.getByLabel('QNH', { exact: true }).fill('1013.25')
  await page.getByLabel('Pressure-altitude field elevation', { exact: true }).fill('1000')

  const takeoff = page.getByRole('group', { name: 'Takeoff raw distances' })
  const derived = await takeoff.locator('dd').allTextContents()
  // Independent published formula, no call into product calculation code.
  const pressure = (1013.25 ** 0.190284 - 1013.25 ** 0.190284 * 0.0065 / 288 * 304.8) ** (1 / 0.190284) + 0.3
  const expectedPa = 145366.45 * (1 - (pressure / 1013.25) ** 0.190284)
  expect(expectedPa).toBeCloseTo(991.567192096912, 9)
  await expect(takeoff.locator('dd')).toHaveText(['219.9 m', '319.9 m'])
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill(String(expectedPa))

  expect(await takeoff.locator('dd').allTextContents()).toEqual(derived)
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await page.getByLabel('Pressure-altitude field elevation unit', { exact: true }).selectOption('m')
  await expect(page.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('304.8')

  expect(await takeoff.locator('dd').allTextContents()).toEqual(derived)
  await info.attach('independent-pa-reference', { body: JSON.stringify({ expectedPa, derived }), contentType: 'application/json' })
  await context.setOffline(true); expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await expect(page.getByLabel('Pressure altitude (ft)', { exact: true })).toHaveValue('')
  await page.clock.setFixedTime(new Date(Date.now() + 100 * 86400000))
  await page.reload()
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  await page.getByLabel('Mass (kg)', { exact: true }).fill('900')
  await page.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')

  await expect(page.getByRole('region', { name: 'Performance results' })).toContainText(/expired|verification/i)
  await expect(takeoff.locator('dd')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('expired-source.png'), fullPage: true })
  await page.goto('/mass-balance')
  const prepPicker = page.getByLabel('Select aircraft', { exact: true })
  await prepPicker.selectOption((await prepPicker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  await expect(page.getByText('Verification expired.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  await perf.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await perf.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')

  await expect(perf.getByRole('group', { name: 'Takeoff raw distances' }).locator('dd')).toHaveCount(0)
  await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  await expect(preview).toContainText('[UNVERIFIED]')
  await expect(preview).toContainText(/expired|verification/i)
  await page.screenshot({ path: info.outputPath('expired-prep-pack.png'), fullPage: true })
})

test('integrated imperial applicable limits appear in the actual printed calculation table', async ({ page }, info) => {
  const profile = testPohAircraft()
  profile.sourceUnit = 'lb-in'; profile.weighingReports[0]!.bem = 1500; profile.weighingReports[0]!.emptyCg = 40
  profile.certificationCategories = [{ category: 'Normal', mtom: 2400, maxZeroFuelMass: 2000, graphType: 'arm', envelope: [
    { mass: 1500, armOrMoment: 30 }, { mass: 2600, armOrMoment: 30 }, { mass: 2600, armOrMoment: 50 }, { mass: 1500, armOrMoment: 50 },
  ] }]
  await importReviewed(page, profile); await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  const table = preview.locator('table').filter({ hasText: 'Applicable limit' })
  await expect.soft(table).toContainText('MTOM: 1088.6 kg')
  await expect.soft(table).toContainText('MZFM: 907.1 kg')
  await preview.getByRole('button', { name: 'Print Briefing Pack' }).click()
  await page.emulateMedia({ media: 'print' }); await expect(table).toBeVisible()
  await page.pdf({ path: info.outputPath('imperial-limits.pdf'), preferCSSPageSize: true })
})

test('integrated locale absent and unsupported use the displayed CEO fallback', async ({ page }) => {
  for (const language of [null, 'zz-ZZ']) {
    await page.addInitScript(value => {
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => value ?? undefined })
      Object.defineProperty(navigator, 'languages', { configurable: true, get: () => value ? [value] : [] })
    }, language)
    await page.goto('/performance')
    const gate = page.getByTestId('disclaimer-gate-accept')
    if (await gate.isVisible()) await gate.click()
    const units = page.getByRole('group', { name: 'Unit preferences' })
    await expect(units).toContainText('reads no locale or region')
    await expect(units.getByLabel('Field elevation', { exact: true })).toHaveValue('ft')
    await expect(units.getByLabel('Declared runway distances', { exact: true })).toHaveValue('m')
    await expect(units).toContainText('hPa'); await expect(units).toContainText('ft')
  }
})

test('integrated complete-grid Draft and invalid M&B cannot expose raw success or print success', async ({ page }, info) => {
  await page.goto('/fleet'); await page.getByTestId('disclaimer-gate-accept').click()
  const profile = testPohAircraft()
  profile.loadPoints = [{ name: 'QA loading', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1500, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null }]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'draft-complete.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await expect(page.getByRole('button', { name: 'Verify D-TEST', exact: true })).toBeVisible()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  await perf.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await perf.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')

  await expect(perf).toContainText(/verify|verified/i)
  await expect(perf.getByRole('group', { name: 'Takeoff raw distances' }).locator('dd')).toHaveCount(0)
  await page.locator('#station-0').fill('-'); await page.locator('#station-0').blur()

  await expect(perf.getByRole('group', { name: 'Takeoff raw distances' }).locator('dd')).toHaveCount(0)
  await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Briefing Pack preview' })).toHaveCount(0)
  await page.evaluate(() => window.print()); await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.mb-print-sheet')).toBeHidden(); await expect(page.locator('.mb-print-guard')).toBeVisible()
  await page.screenshot({ path: info.outputPath('invalid-mb-print-guard.png') })
})
