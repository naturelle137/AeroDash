import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic data establishes software wiring only, never aircraft applicability.
test('live partial edits recover, warnings follow their values and inline units fit 320px', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  for (const table of profile.performanceProfiles!) {
    for (const point of table.dataPoints) if (point.mass === 800) point.mass = 757.4992579000001
  }
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-live.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const verification = page.getByRole('dialog')
  await verification.getByLabel('Verifier initials').fill('QA')
  await verification.getByLabel('POH revision').fill('Synthetic browser wiring only')
  await verification.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(verification).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).getAttribute('value'))!)
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  const takeoff = perf.getByRole('group', { name: 'Takeoff raw distances' })
  const landing = perf.getByRole('group', { name: 'Landing raw distances' })
  const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  for (const offline of [false, true]) {
    if (offline) { await context.setOffline(true); expect((await page.reload())?.fromServiceWorker()).toBe(true) }
    await expect(perf.locator('.bounds')).toContainText('757.5 to 1000.0 kg')
    await expect(perf).not.toContainText('757.4992579000001')
    await expect(perf.getByRole('button', { name: /Compute|Calculate/ })).toHaveCount(0)
    const ids = await page.locator('.fp-view > section[id^="prep-card-"]').evaluateAll(nodes => nodes.map(n => n.id))
    // The DOM order is also the natural focus order; sticky metadata is checked after scrolling.
    expect(ids.indexOf('prep-card-fuel')).toBeLessThan(ids.indexOf('prep-card-performance'))
    await fuel.getByLabel('Planning method').selectOption('duration')
    await fuel.getByLabel('Planned average consumption (kg/h)').fill('20')
    await fuel.getByLabel('Planned flight duration (min)').fill('60')
    await fuel.getByLabel('Reserve duration (min)').fill('120')
    await perf.getByRole('radio', { name: 'Derive from QNH and field elevation' }).check()
    await perf.getByLabel('QNH', { exact: true }).fill('940')
    await perf.getByLabel('Pressure-altitude field elevation', { exact: true }).fill('-100')
    await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')
    await expect(takeoff.locator('dd').first()).toContainText('WARN-UI-001')
    await expect(landing.locator('dd')).toHaveCount(2)
    const old = await landing.locator('dd').first().textContent()
    await fuel.getByLabel('Planned flight duration (min)').fill('90')
    await expect(landing.locator('dd').first()).not.toHaveText(old!)
    await fuel.getByLabel('Planned flight duration (min)').fill('')
    await expect(landing.locator('dd')).toHaveCount(0)
    await expect(takeoff.locator('dd')).toHaveCount(2)
    await fuel.getByLabel('Planned flight duration (min)').fill('60')
    await expect(landing.locator('dd')).toHaveCount(2)
    const temperature = perf.getByLabel('Temperature (°C)', { exact: true })
    for (const invalid of ['', '-', '1e', 'Infinity']) {
      await temperature.fill(invalid)
      await expect(takeoff.locator('dd')).toHaveCount(0)
    }
    await temperature.fill('10')
    await expect(takeoff.locator('dd')).toHaveCount(2)
    await expect(perf.locator('details.method-limits')).not.toHaveAttribute('open')
    await perf.getByText('Method: NOAA/NWS altimeter-setting and pressure-altitude formulas', { exact: true }).click()
    await expect(perf.locator('details.method-limits')).toHaveAttribute('open', '')
    await perf.getByText('Method: NOAA/NWS altimeter-setting and pressure-altitude formulas', { exact: true }).click()
    const originalViewport = page.viewportSize()!
    for (const width of [originalViewport.width, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const [inputId, unitId] of [['pa-qnh', 'pa-qnh-unit'], ['pa-elevation', 'pa-elevation-unit'], ['manual-runway-tora', 'manual-runway-tora-unit'], ['manual-runway-lda', 'manual-runway-lda-unit'], ['manual-runway-elevation', 'manual-runway-elevation-unit']]) {
        const input = perf.locator(`#${inputId}`); const unit = perf.locator(`#${unitId}`)
        await input.scrollIntoViewIfNeeded()
        const a = (await input.boundingBox())!; const b = (await unit.boundingBox())!
        expect(b.x).toBeGreaterThanOrEqual(a.x + a.width)
        expect(Math.abs((b.y + b.height / 2) - (a.y + a.height / 2))).toBeLessThanOrEqual(4)
        expect(b.x + b.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: info.outputPath(`inline-${width}-${offline}.png`) })
    }
    await page.setViewportSize(originalViewport)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const sticky = page.getByRole('navigation', { name: 'Scrolled-past sections' })
    await expect(sticky.getByRole('button', { name: 'Scroll to Fuel & Endurance' })).toBeVisible()
    await expect(sticky.getByRole('button', { name: 'Scroll to Performance' })).toBeVisible()
    const navigation = await sticky.getByRole('button').allTextContents()
    expect(navigation.findIndex(s => s.includes('Fuel & Endurance'))).toBeLessThan(navigation.findIndex(s => s.includes('Performance')))
    await action.click()
    await expect(preview.locator('td.briefing-warning').filter({ hasText: 'WARN-FE-001' }).first()).toContainText('Insufficient fuel')
    await expect(preview.locator('td.briefing-warning').filter({ hasText: 'WARN-UI-001' })).toHaveCount(4)
    await preview.getByRole('button', { name: 'Print Briefing Pack', exact: true }).click()
    const pdf = info.outputPath(`value-warnings-${offline}.pdf`)
    await page.emulateMedia({ media: 'print' })
    await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: false })
    await page.emulateMedia({ media: 'screen' })
    await info.attach('native-value-warnings', { path: pdf, contentType: 'application/pdf' })
    // Inspect the captured artifact, including each value's adjacent warning.
    const pdfText = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
    expect(pdfText).toContain('Flight Preparation Briefing Pack')
    for (const control of ['Back to preparation', 'Print Briefing Pack', 'Select aircraft', 'Planning method']) {
      expect(pdfText).not.toContain(control)
    }
    const qnhWarning = 'WARNING WARN-UI-001: QNH 940 hPa is outside the standard 950–1100 hPa range. Check the value.'
    for (const value of ['247.0 m', '347.0 m', '430.6 m', '530.6 m']) {
      expect(pdfText).toContain(`${value} ${qnhWarning}`)
    }
    expect(pdfText.split(qnhWarning)).toHaveLength(5)
    const fuelWarning = 'WARN-FE-001 — Insufficient fuel for the entered trip plus reserve.'
    expect(pdfText).toContain(`Trip + reserve fuel 60 kg ${fuelWarning}`)
    expect(pdfText).toContain(`Fuel shortfall 10 kg ${fuelWarning}`)
    await page.keyboard.press('Escape')
    await fuel.getByLabel('Planning method').selectOption('direct')
    await fuel.getByLabel('Trip Fuel (kg)', { exact: true }).fill('20')
    await expect(landing.locator('dd')).toHaveCount(2)
    await fuel.getByLabel('Trip Fuel (kg)', { exact: true }).fill('999')
    await expect(landing.locator('dd')).toHaveCount(0)
    await expect(takeoff.locator('dd')).toHaveCount(2)
    await page.keyboard.press('Control+p')
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.mb-print-guard')).toBeVisible()
    await page.pdf({ path: info.outputPath(`closed-native-guard-${offline}.pdf`), preferCSSPageSize: true })
    await page.emulateMedia({ media: 'screen' })
  }
  expect(errors).toEqual([])
})
