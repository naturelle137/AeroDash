import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic software vectors only. BEM includes 10 kg unusable; fixed arm 3 m.
function profile(registration: string, id: string, quantity: number) {
  const p = testPohAircraft()
  return {
    ...p, id, registration, sourceUnit: 'kg-m', performanceProfiles: [],
    weighingReports: [{ bem: 560, emptyCg: 2, weighingDate: '2026-01-01', validFrom: '2026-01-01' }],
    certificationCategories: [{ category: 'Normal', mtom: 1000, maxZeroFuelMass: null, graphType: 'arm', envelope: [
      { mass: 500, armOrMoment: 0 }, { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 4 }, { mass: 500, armOrMoment: 4 },
    ] }],
    loadPoints: [{ name: 'Fixed tank', kind: 'fuel', arm: 3, armLookup: [], operationalLimit: null,
      defaultQuantity: quantity, unit: 'kg', allowableCategories: null,
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } }],
  }
}

test('fixed-arm lower boundary retains input, invalidates open print and recovers online/offline', async ({ page, context }, info) => {
  const errors: string[] = []
  const previewWarnings: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => {
    if (m.type() !== 'error') return
    if (m.text() === "The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.") previewWarnings.push(m.text())
    else errors.push(m.text())
  })
  const shot = async (name: string) => {
    const path = info.outputPath(`${name}.png`)
    await page.screenshot({ path, fullPage: true })
    await info.attach(name, { path, contentType: 'image/png' })
    if (['below-minimum', 'offline-equality-bem'].includes(name)) {
      const detail = info.outputPath(`${name}-viewport.png`)
      await page.screenshot({ path: detail })
      await info.attach(`${name}-viewport`, { path: detail, contentType: 'image/png' })
    }
  }
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  for (const p of [profile('D-FIXED', '00000000-0000-4000-a000-000000005331', 30), profile('D-LOW', '00000000-0000-4000-a000-000000005332', 9)]) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-fixed-arm.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile: p })),
    })
    await expect(page.getByRole('button', { name: `Verify ${p.registration}`, exact: true })).toBeVisible()
  }
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  const select = async (registration: string) => {
    await picker.selectOption((await picker.locator('option').filter({ hasText: registration }).first().getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  const tank = page.locator('#station-0')
  const summary = page.getByRole('region', { name: 'Calculation results' })
  const mass = summary.locator('.result-summary__item', { hasText: 'Takeoff Mass' })
  const cg = summary.locator('.result-summary__item', { hasText: 'CG (Takeoff)' })
  const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview', exact: true })
  const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  const error = page.getByRole('alert').filter({ hasText: 'Invalid input: Fixed tank (BELOW_UNUSABLE)' })
  const load = async (q: string) => { await tank.fill(q); await tank.blur() }
  const blocked = async () => {
    await expect(error).toContainText('Minimum total load is 10 kg')
    await expect(tank).toHaveValue('9')
    await expect(tank).toHaveAttribute('aria-invalid', 'true')
    await expect(summary).toHaveCount(0)
    for (const key of ['tom', 'lm', 'zfm']) await expect(page.getByTestId(`cg-point-label-${key}`)).toHaveCount(0)
    await expect(fuel.getByTestId('arrival-cg')).toHaveCount(0)
    await expect(fuel.getByRole('region', { name: 'Estimated trip arrival', exact: true })).toHaveCount(0)
  }
  await select('D-FIXED')
  await expect(mass).toContainText('580.0')
  await expect(cg).toContainText('2.034')
  await fuel.getByLabel('Planning method').selectOption('direct')
  await fuel.getByLabel('Trip Fuel (kg)', { exact: true }).fill('10')
  await expect(fuel.getByRole('region', { name: 'Estimated trip arrival', exact: true })).toContainText('570 kg')
  await action.click()
  await expect(preview).toContainText('580.0 kg [UNVERIFIED]')
  await expect(preview).toContainText('2.034 m [UNVERIFIED]')
  await shot('valid-print')
  // Real input event while preview is open, then native printing before Vue renders.
  const invalidGuard = await tank.evaluate((element: HTMLInputElement) => {
    element.value = '9'
    element.dispatchEvent(new Event('input', { bubbles: true }))
    window.dispatchEvent(new Event('beforeprint'))
    return document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')
  })
  expect(invalidGuard).toBe('true')
  await expect(preview).toContainText('Preview invalidated')
  await expect(preview).not.toContainText('580.0 kg')
  await expect(preview.getByRole('button', { name: 'Print Briefing Pack', exact: true })).toBeDisabled()
  await shot('open-print-invalidated')
  await page.keyboard.press('Escape')
  await blocked()
  await action.click()
  await expect(preview).toHaveCount(0)
  await expect(page.locator('#briefing-eligibility')).toContainText('not eligible')
  await error.scrollIntoViewIfNeeded()
  await shot('below-minimum')
  // Keep an invalid current load across a cached offline reload.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aerodash:session:payload'))).toContain('"weight":9')
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await blocked()
  await shot('offline-restored-invalid')
  await load('10')
  await expect(error).toHaveCount(0)
  await expect(mass).toContainText('560.0')
  await expect(cg).toContainText('2.000')
  await shot('offline-equality-bem')
  await load('30')
  await expect(mass).toContainText('580.0')
  await expect(cg).toContainText('2.034')
  await action.click()
  await expect(preview).toContainText('580.0 kg [UNVERIFIED]')
  await shot('offline-recovered-print')
  await page.keyboard.press('Escape')
  // An imported profile with an invalid persisted default fails immediately.
  await select('D-LOW')
  await blocked()
  await shot('invalid-profile-default')
  await load('10')
  await expect(mass).toContainText('560.0')
  await load('30')
  await expect(cg).toContainText('2.034')
  await context.setOffline(false)
  await info.attach('console-errors', { body: JSON.stringify({ errors, previewWarnings }), contentType: 'application/json' })
  expect(errors).toEqual([])
})
