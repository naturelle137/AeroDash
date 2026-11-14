import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic arithmetic vectors only (BEM 500 kg + one payload station); no operational aircraft validation.
// Expected differences are limit − mass computed by hand.
test('current mass-limit differences update without stale values, cached offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const base = testPohAircraft()
  base.loadPoints = [{
    name: 'Synthetic payload', kind: 'occupant', occupancy: 'required',
    arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 0, unit: 'kg',
    allowableCategories: null, fuelTank: null,
  }]
  base.performanceProfiles = []
  const normal = { ...base.certificationCategories[0]!, category: 'Normal', mtom: 1000, maxZeroFuelMass: 900 }
  const utility = { ...normal, category: 'Utility', mtom: 900, maxZeroFuelMass: null }
  const profiles = [
    { ...base, registration: 'D-LIMV', id: '00000000-0000-4000-a000-000000000522', certificationCategories: [normal] },
    { ...base, registration: 'D-LIMA', certificationCategories: [normal, utility] },
    { ...base, registration: 'D-LIMB', id: '00000000-0000-4000-a000-000000000521', certificationCategories: [utility] },
  ]
  for (const profile of profiles) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-limits.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true })).toBeVisible()
  }
  // Only D-LIMV is verified, so its calculations can reach genuine success (no draft warning).
  await page.getByRole('button', { name: 'Verify D-LIMV', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only - no real POH')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')

  const picker = page.getByLabel('Select aircraft', { exact: true })
  async function pick(registration: string) {
    const option = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await option.getAttribute('value'))!)
  }
  async function select(registration: string) {
    await pick(registration)
    if (registration !== 'D-LIMV') await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  const input = page.locator('#station-0')
  const takeoff = page.getByTestId('takeoff-limit-difference')
  const zeroFuel = page.getByTestId('zero-fuel-limit-difference')
  const chart = page.getByRole('img', { name: /CG Envelope Chart/ })
  async function load(value: string) {
    await input.fill(value)
    await input.blur()
  }
  async function shot(name: string) {
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' })
  }

  // Genuine success on the verified profile: neutral wording, never "SAFE".
  await select('D-LIMV')
  await load('300')
  await expect(takeoff).toHaveText('Below MTOM by 200.0 kg')
  await expect(chart).toHaveAttribute('aria-label', /CG Envelope Chart — inside entered envelope \(calculated state only\), TOM 800\.0 kg/)
  await expect(chart).not.toHaveAttribute('aria-label', /SAFE|WARNING|CRITICAL/)
  await shot('success-neutral')
  // Raw-conservative boundaries: 0.09999999 kg margin is not "0.1"; 0.10000001 kg excess is not "0.1".
  await load('499.90000001')
  await expect(takeoff).toHaveText('Below MTOM by less than 0.1 kg')
  await shot('raw-below-boundary')
  await load('500.10000001')
  await expect(takeoff).toHaveText('Above MTOM by 0.2 kg')
  await expect(chart).toHaveAttribute('aria-label', /CG Envelope Chart — CRITICAL, TOM 1000\.1 kg/)
  await shot('critical')
  // Invalid input suppresses the stale comparison; correction restores a current one.
  await load('-5')
  await expect(takeoff).toHaveCount(0)
  await expect(page.locator('.result-summary__scope')).toHaveCount(0)
  await shot('invalid-input')
  await load('300')
  await expect(takeoff).toHaveText('Below MTOM by 200.0 kg')

  await select('D-LIMA')
  await expect(page.getByRole('button', { name: 'M&B print preview', exact: true })).toBeVisible()

  // Below both limits: TOM 800 (1000), ZFM 800 (900).
  await load('300')
  await expect(takeoff).toHaveText('Below MTOM by 200.0 kg')
  await expect(zeroFuel).toHaveText('Below MZFM by 100.0 kg')
  await expect(page.locator('.result-summary__scope')).toContainText('not a flight-suitability or Go/No-Go determination')
  await expect(chart).not.toHaveAttribute('aria-label', /SAFE/)
  await expect(chart).toHaveAttribute('aria-label', /CG Envelope Chart — (inside entered envelope \(calculated state only\)|WARNING), TOM 800\.0 kg/)
  await expect(page.locator('.notification--warning').first()).toBeVisible() // draft/profile warnings stay
  await shot('below')

  // ZFM exactly at MZFM (900), TOM 900.
  await load('400')
  await expect(zeroFuel).toHaveText('Exactly at MZFM')
  await expect(takeoff).toHaveText('Below MTOM by 100.0 kg')
  await shot('at-mzfm')

  // Raw-rounding boundary: 0.05 kg below MTOM must not read as at/zero, nor as margin.
  await load('499.95')
  await expect(takeoff).toHaveText('Below MTOM by less than 0.1 kg')
  await expect(zeroFuel).toHaveText('Above MZFM by 100.0 kg')
  // Exactly at MTOM.
  await load('500')
  await expect(takeoff).toHaveText('Exactly at MTOM')
  // 0.05 kg above must not be rounded down to zero.
  await load('500.05')
  await expect(takeoff).toHaveText('Above MTOM by 0.1 kg')
  await expect(page.locator('.notification--critical').first()).toBeVisible()
  await shot('above')

  // Correction removes the exceedance without a stale value.
  await load('450')
  await expect(takeoff).toHaveText('Below MTOM by 50.0 kg')
  await expect(zeroFuel).toHaveText('Above MZFM by 50.0 kg')

  // Category without MZFM: only the MTOM comparison remains (900 − 950 = 50.0 above).
  await page.locator('#category-select').selectOption('Utility')
  await expect(takeoff).toHaveText('Above MTOM by 50.0 kg')
  await expect(zeroFuel).toHaveCount(0)
  await shot('utility-no-mzfm')

  // Profile change must not keep a number from the previous profile.
  // The payload resets to 0 kg, so only the empty-mass comparison (900 − 500) may show.
  await select('D-LIMB')
  await expect(takeoff).toHaveText('Below MTOM by 400.0 kg')
  await expect(zeroFuel).toHaveCount(0)
  await load('300')
  await expect(takeoff).toHaveText('Below MTOM by 100.0 kg')
  await expect(zeroFuel).toHaveCount(0)

  // Pending (draft) confirmation: the previous profile's number must not stay visible.
  await load('300')
  await expect(takeoff).toHaveText('Below MTOM by 100.0 kg')
  await pick('D-LIMA')
  await expect(page.getByRole('button', { name: 'Continue anyway', exact: true })).toBeVisible()
  await expect(takeoff).toHaveCount(0)
  await expect(zeroFuel).toHaveCount(0)
  await shot('pending-confirmation')
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await expect(takeoff).toHaveText('Below MTOM by 500.0 kg')

  // Cached offline reload: session inputs are not persisted; re-enter them.
  await context.setOffline(true)
  await page.reload()
  await select('D-LIMA')
  await expect(takeoff).toHaveText('Below MTOM by 500.0 kg')
  await expect(zeroFuel).toHaveText('Below MZFM by 400.0 kg')
  await load('400')
  await expect(takeoff).toHaveText('Below MTOM by 100.0 kg')
  await expect(zeroFuel).toHaveText('Exactly at MZFM')
  await expect(chart).not.toHaveAttribute('aria-label', /SAFE/)
  // Mobile: results and scope text are inside the viewport width.
  const box = await page.locator('.result-summary').boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  await shot('offline')
  await context.setOffline(false)
})
