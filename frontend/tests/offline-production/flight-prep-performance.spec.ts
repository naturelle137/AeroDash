import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic 750 kg BEM + 100 kg payload + 50 kg fuel. Linear table formula:
// 100 + phaseIndex*100 + mass-800 + PA/100 + temperature (metres).
test('Flight Prep shares current phase masses and converted units online and cached offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  profile.certificationCategories.push({ ...profile.certificationCategories[0]!, category: 'Utility' })
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-performance.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  const alternate = { ...profile, id: '00000000-0000-4000-a000-000000000429', registration: 'D-NEXT', performanceProfiles: [] }
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-missing-tables.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile: alternate })) })
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  const option = picker.locator('option').filter({ hasText: 'D-TEST' }).first()
  const selectedId = (await option.getAttribute('value'))!
  await picker.selectOption(selectedId)
  const performance = page.getByRole('region', { name: 'Performance', exact: true })
  const takeoff = performance.getByRole('group', { name: 'Takeoff raw distances' })
  const landing = performance.getByRole('group', { name: 'Landing raw distances' })
  const payload = page.getByRole('textbox', { name: 'Synthetic payload', exact: true })
  const tank = page.getByRole('textbox', { name: 'Synthetic tank', exact: true })
  const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  const method = fuel.getByLabel('Planning method')
  const burn = fuel.getByLabel('Trip Fuel (kg)')
  const preferences = performance.getByRole('group', { name: 'Unit preferences' })
  const runway = performance.getByRole('form', { name: 'Manual runway', exact: true })
  const pa = performance.getByLabel('Pressure altitude (ft)', { exact: true })
    async function conditions() {
    await performance.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
    await pa.fill('1000')
    await performance.getByLabel('Temperature (°C)', { exact: true }).fill('10')
  }
  async function shot(name: string) {
    await performance.getByRole('region', { name: 'Base performance distances', exact: true }).scrollIntoViewIfNeeded()
    const path = info.outputPath(`${name}.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await info.attach(name, { path, contentType: 'image/png' })
  }
  await payload.fill('100'); await payload.blur()
  await tank.fill('50'); await tank.blur()
  await expect(performance.getByLabel('Aircraft profile', { exact: true })).toHaveCount(0)
  await expect(performance.getByLabel('Mass (kg)', { exact: true })).toHaveCount(0)
  await expect(preferences.getByLabel('Field elevation', { exact: true })).toHaveValue('ft')
  await expect(preferences.getByLabel('Declared runway distances', { exact: true })).toHaveValue('m')
  await expect(runway.getByLabel('TORA unit', { exact: true })).toHaveValue('m')
  await expect(runway.getByLabel('Field elevation unit', { exact: true })).toHaveValue('ft')
  await conditions();
  await expect(takeoff.locator('dd')).toHaveText(['220.0 m', '320.0 m'])
  await expect(landing).toContainText('No trip-arrival mass')
  await method.selectOption('direct'); await burn.fill('20');
  await expect(landing.locator('dd')).toHaveText(['400.0 m', '500.0 m'])
  await expect(takeoff).toContainText('900.0 kg')
  await expect(landing).toContainText('880.0 kg')
  await shot('shared-masses-online')
  await burn.fill('999')
  await expect(takeoff.locator('dd')).toHaveCount(2)

  await expect(takeoff.locator('dd')).toHaveCount(2)
  await expect(landing.locator('dd')).toHaveCount(0)
  await burn.fill('20');
  await payload.fill('101'); await payload.blur()
  await expect(takeoff.locator('dd').first()).toHaveText('221.0 m')
  await payload.fill('100'); await payload.blur()
  await page.getByLabel('Certification category', { exact: true }).selectOption('Utility')
  await expect(takeoff.locator('dd').first()).toHaveText('220.0 m')

  await expect(takeoff.locator('dd')).toHaveCount(2)
  await page.getByLabel('Certification category', { exact: true }).selectOption('Normal')

  // Same physical quantity through genuine field-unit conversion, save and reopen.
  await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic field')
  await runway.getByLabel('Runway designator', { exact: true }).fill('18')
  await runway.getByLabel('TORA — takeoff run available', { exact: true }).fill('1000')
  await runway.getByLabel('TORA unit', { exact: true }).selectOption('ft')
  await expect(runway.getByLabel('TORA — takeoff run available', { exact: true })).toHaveValue('3280.8399')
  await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('900')
  await runway.getByLabel('Field elevation', { exact: true }).fill('1e3')
  await runway.getByLabel('Field elevation unit', { exact: true }).selectOption('m')
  await expect(runway.getByLabel('Field elevation', { exact: true })).toHaveValue('304.8')
  await runway.getByLabel('Surface type', { exact: true }).selectOption('paved')
  await runway.getByLabel('Surface condition', { exact: true }).selectOption('dry')
  await runway.getByRole('button', { name: 'Save runway inputs', exact: true }).click()
  await preferences.getByLabel('Field elevation', { exact: true }).selectOption('m')
  await preferences.getByLabel('Declared runway distances', { exact: true }).selectOption('ft')
  await performance.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(performance.getByLabel('QNH unit', { exact: true })).toHaveValue('hPa')
  await performance.getByLabel('QNH', { exact: true }).fill('1013.25')
  await performance.getByRole('button', { name: 'Use saved manual runway elevation' }).click()

  // Exact standard QNH preserves the copied 1000 ft elevation.
  await expect(takeoff.locator('dd')).toHaveText(['220.0 m', '320.0 m'])
  await performance.getByLabel('Derived pressure altitude', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('qnh-standard.png') })
  await performance.getByLabel('Pressure-altitude field elevation unit', { exact: true }).selectOption('ft')
  await expect(performance.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('1000')
  await expect(takeoff.locator('dd')).toHaveText(['220.0 m', '320.0 m'])
  // Ordinary Flight Prep, no store injection: negative/zero/positive elevations,
  // exact standard versus rounded setting, and a case exposing display-before-lookup rounding.
  const qnh = performance.getByLabel('QNH', { exact: true })
  const elevation = performance.getByLabel('Pressure-altitude field elevation', { exact: true })
  const derived = performance.getByLabel('Derived pressure altitude', { exact: true })
  const evidence = []
  for (const [pressure, height, display] of [
    ['1013.25', '-100', '-100'], ['1013.25', '0', '0'], ['1013', '0', '7'],
    ['1013.25', '1000', '1000'], ['1000', '1490.7', '1855'],
  ]) {
    await qnh.fill(pressure!); await elevation.fill(height!)
    await expect(derived).toContainText(`Derived pressure altitude: ${display} ft`)
    evidence.push({ qnh: pressure, elevationFt: height, displayedPa: await derived.innerText(), distances: await takeoff.locator('dd').allTextContents() })
  }
  // Independent Decimal reference PA 1854.494043220 ft, TOR 228.544940432 m.
  await expect(takeoff.locator('dd')).toHaveText(['228.5 m', '328.5 m'])
  await performance.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await expect(pa).toHaveValue('1000')
  await pa.fill('1855')
  await expect(takeoff.locator('dd')).toHaveText(['228.6 m', '328.6 m'])
  await performance.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(takeoff.locator('dd')).toHaveText(['228.5 m', '328.5 m'])
  await performance.getByLabel('Pressure-altitude field elevation unit', { exact: true }).selectOption('m')
  await expect(elevation).toHaveValue('454.3654')
  await expect(takeoff.locator('dd')).toHaveText(['228.5 m', '328.5 m'])
  for (const invalid of ['', '849.99', '1100.01', 'Infinity']) {
    await qnh.fill(invalid)
    await expect(takeoff.locator('dd')).toHaveCount(0)
    await expect(derived).toHaveCount(0)
  }
  await qnh.fill('940')
  await expect(performance.getByRole('alert').filter({ hasText: '950' })).toBeVisible()
  await qnh.fill('1000')
  await expect(takeoff.locator('dd')).toHaveCount(2)
  await info.attach('qnh-independent-reference-and-browser-results', { body: JSON.stringify({ rawPaFt: 1854.494043220, rawTorM: 228.544940432, roundedPaTorM: 228.55, evidence }, null, 2), contentType: 'application/json' })
  const originalViewport = page.viewportSize()!
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 440, height: 894 }, { width: 320, height: 894 }]) {
    await page.setViewportSize(viewport)
    await derived.evaluate(node => node.scrollIntoView({ block: 'center' }))
    await expect(derived).toBeInViewport({ ratio: 1 })
    // Let Chromium paint the resized viewport before capturing offline evidence.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    const path = info.outputPath(`qnh-${viewport.width}.png`)
    await page.screenshot({ path, animations: 'disabled' }); await info.attach(`qnh-${viewport.width}`, { path, contentType: 'image/png' })
  }
  await page.setViewportSize(originalViewport)
  // Restore the copied elevation before checking saved-runway invalidation.
  await qnh.fill('1013.25')
  await performance.getByRole('button', { name: 'Use saved manual runway elevation' }).click()
  await runway.getByLabel('Runway designator', { exact: true }).fill('19')
  await expect(takeoff.locator('dd')).toHaveCount(0)
  await runway.getByRole('button', { name: /Discard/ }).click()

  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(preferences.getByLabel('Field elevation', { exact: true })).toHaveValue('m')
  await expect(preferences.getByLabel('Declared runway distances', { exact: true })).toHaveValue('ft')
  await expect(runway.getByLabel('TORA — takeoff run available', { exact: true })).toHaveValue('3280.8399')
  await expect(runway.getByLabel('Field elevation', { exact: true })).toHaveValue('304.8')
  await expect(method).toHaveValue('')
  await performance.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(performance.getByLabel('QNH', { exact: true })).toHaveValue('')
  await expect(performance.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('')
  await expect(performance.getByLabel('Pressure-altitude field elevation unit', { exact: true })).toHaveValue('m')
  await conditions(); await method.selectOption('direct'); await burn.fill('20');
  await expect(takeoff.locator('dd')).toHaveText(['220.0 m', '320.0 m'])
  await expect(landing.locator('dd')).toHaveText(['400.0 m', '500.0 m'])
  await shot('shared-masses-offline')
  await performance.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await qnh.fill('1013'); await elevation.fill('0')
  await expect(derived).toContainText('Derived pressure altitude: 7 ft')
  await expect(takeoff.locator('dd')).toHaveText(['210.1 m', '310.1 m'])
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 440, height: 894 }, { width: 320, height: 894 }]) {
    await page.setViewportSize(viewport)
    await derived.evaluate(node => node.scrollIntoView({ block: 'center' }))
    await expect(derived).toBeInViewport({ ratio: 1 })
    // Let Chromium paint the resized viewport before capturing offline evidence.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    const path = info.outputPath(`qnh-warmed-offline-${viewport.width}.png`)
    await page.screenshot({ path, animations: 'disabled' }); await info.attach(`qnh-warmed-offline-${viewport.width}`, { path, contentType: 'image/png' })
  }
  await page.setViewportSize(originalViewport)
  await conditions()

  // Exact max, upper excursion, exact minimum and below-min benefit cap.
  for (const [load, expected] of [['200', '320.0 m'], ['201', null], ['0', '120.0 m']] as const) {
    await payload.fill(load); await payload.blur();
    if (expected === null) await expect(takeoff).toContainText('above the table maximum')
    else await expect(takeoff.locator('dd').first()).toHaveText(expected)
  }
  await tank.fill('0'); await tank.blur(); await burn.fill('0');
  await expect(takeoff.locator('dd').first()).toContainText('120.0 m')
  await expect(takeoff).not.toContainText('capped at the documented')
  await performance.getByRole('button', { name: 'Assess correction sources' }).click()
  await expect(performance.getByRole('region', { name: 'Correction sources', exact: true })).toContainText('No wind, surface or slope correction can be applied')
  await shot('source-blocked-offline')
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
  await picker.selectOption('')
  await expect(picker).toHaveValue(selectedId)
  await expect(takeoff.locator('dd').first()).toContainText('120.0 m')
  const next = picker.locator('option').filter({ hasText: 'D-NEXT' }).first()
  await picker.selectOption((await next.getAttribute('value'))!)
  await expect(takeoff.locator('dd')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await expect(performance).toContainText('D-NEXT')

  await expect(performance).toContainText('require exactly one table')
  await expect(takeoff.locator('dd')).toHaveCount(0)
  await expect(preferences.getByLabel('Field elevation', { exact: true })).toHaveValue('m')
  await expect(preferences.getByLabel('Declared runway distances', { exact: true })).toHaveValue('ft')
})

test('unsupported stored unit preferences visibly fall back without restoring numeric conditions', async ({ page }) => {
  await page.goto('/performance')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(() => localStorage.setItem('aerodash.preferences.units.v1', JSON.stringify({ schemaVersion: 1, qnh: 'inHg', pressureAltitude: 'ft', fieldElevation: 'm', runwayDistance: 'ft', numericPa: 1234 })))
  await page.reload()
  const units = page.getByRole('group', { name: 'Unit preferences' })
  await expect(units.getByRole('alert')).toContainText('invalid or unsupported')
  await expect(units.getByLabel('Field elevation', { exact: true })).toHaveValue('ft')
  await expect(units.getByLabel('Declared runway distances', { exact: true })).toHaveValue('m')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(page.getByLabel('QNH unit', { exact: true })).toHaveValue('hPa')
  await expect(page.getByLabel('QNH', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('')
})
