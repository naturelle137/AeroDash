import { expect, test, type Page } from '@playwright/test'
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

/**
 * Rendered envelope polygon bounds and the ZFM marker centre (label at cx + 9, cy − 10),
 * in SVG user units. Envelope and points share axes only if both are in the same unit.
 */
async function chartGeometry(page: Page) {
  const points = (await page.getByTestId('cg-envelope-polygon').getAttribute('points'))!
    .split(' ').map((pair) => pair.split(',').map(Number) as [number, number])
  const label = page.getByTestId('cg-point-label-zfm')
  const zfm = { x: Number(await label.getAttribute('x')) - 9, y: Number(await label.getAttribute('y')) + 10 }
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { box: { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) }, zfm }
}

async function expectZfmInsideDrawnEnvelope(page: Page) {
  const { box, zfm } = await chartGeometry(page)
  expect(zfm.x).toBeGreaterThan(box.xMin)
  expect(zfm.x).toBeLessThan(box.xMax)
  expect(zfm.y).toBeGreaterThan(box.yMin)
  expect(zfm.y).toBeLessThan(box.yMax)
}

// PR #522 review finding 1: lb-in profile limits must be compared in kg. Synthetic vectors only:
// BEM 1500 lb + one lb payload station; 1 lb = 0.45359237 kg. MTOM 2400 lb = 1088.621688 kg,
// MZFM 2000 lb = 907.18474 kg. Raw (unconverted) limits would read "Below MTOM by 1451.9 kg".
test('imperial lb-in profile compares mass with kg-normalized MTOM/MZFM', async ({ page }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()

  const base = testPohAircraft()
  const envelope = [
    { mass: 1500, armOrMoment: 30 }, { mass: 2600, armOrMoment: 30 },
    { mass: 2600, armOrMoment: 50 }, { mass: 1500, armOrMoment: 50 },
  ]
  const profile = {
    ...base, id: '00000000-0000-4000-a000-000000005221', registration: 'N522LB', sourceUnit: 'lb-in',
    performanceProfiles: [],
    weighingReports: [{ bem: 1500, emptyCg: 40, weighingDate: '2026-01-01', validFrom: '2026-01-01' }],
    loadPoints: [{
      name: 'Synthetic payload', kind: 'occupant', occupancy: 'required',
      arm: 38, armLookup: [], operationalLimit: 1200, defaultQuantity: 0, unit: 'lb',
      allowableCategories: null, fuelTank: null,
    }],
    certificationCategories: [
      { category: 'Normal', mtom: 2400, maxZeroFuelMass: null, graphType: 'arm', envelope },
      { category: 'Utility', mtom: 2400, maxZeroFuelMass: 2000, graphType: 'arm', envelope },
    ],
  }
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-imperial.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
  })
  await expect(page.getByRole('button', { name: 'Verify N522LB', exact: true })).toBeVisible()
  await page.goto('/mass-balance')

  const picker = page.getByLabel('Select aircraft', { exact: true })
  const option = picker.locator('option').filter({ hasText: 'N522LB' }).first()
  await picker.selectOption((await option.getAttribute('value'))!)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()

  const input = page.locator('#station-0')
  const takeoff = page.getByTestId('takeoff-limit-difference')
  const zeroFuel = page.getByTestId('zero-fuel-limit-difference')
  async function load(value: string) {
    await input.fill(value)
    await input.blur()
  }
  async function shot(name: string) {
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' })
  }

  // Normal (no MZFM). 2090 lb = 948.0080533 kg → 140.6136347 kg below, floored.
  await load('590')
  await expect(takeoff).toHaveText('Below MTOM by 140.6 kg')
  await expect(zeroFuel).toHaveCount(0)
  await expect(page.locator('.result-summary__limit').first()).not.toContainText('2400')
  // MTOM 1088.621688 kg is floored, never shown as an inflated 1089.
  await expect(page.locator('.result-summary__limit').first()).toHaveText('/ MTOM 1088.6 kg')
  // Envelope 30–50 in / 1500–2600 lb is drawn in m/kg with the SI points:
  // ZFM 2090 lb at 39.435 in = 948.0 kg at 1.002 m lies inside it.
  await expect(page.getByText('CG Arm (m)', { exact: true })).toBeVisible()
  await expectZfmInsideDrawnEnvelope(page)
  await shot('imperial-below-mtom')
  await load('900') // 2400 lb
  await expect(takeoff).toHaveText('Exactly at MTOM')
  await load('1000') // 2500 lb = 1133.980925 kg → 45.359237 kg above, ceiled.
  await expect(takeoff).toHaveText('Above MTOM by 45.4 kg')
  await expect(page.locator('.notification--critical').first()).toBeVisible()
  await shot('imperial-above-mtom')

  // Utility adds MZFM 2000 lb.
  await page.locator('#category-select').selectOption('Utility')
  await load('400') // ZFM 1900 lb
  await expect(zeroFuel).toHaveText('Below MZFM by 45.3 kg')
  await expect(takeoff).toHaveText('Below MTOM by 226.7 kg')
  await expect(page.locator('.result-summary__limit').nth(1)).toHaveText('/ MZFM 907.1 kg')
  await expectZfmInsideDrawnEnvelope(page)
  await load('500')
  await expect(zeroFuel).toHaveText('Exactly at MZFM')
  await load('600')
  await expect(zeroFuel).toHaveText('Above MZFM by 45.4 kg')
  await shot('imperial-utility-mzfm')

  // Back to a category without MZFM: the zero-fuel comparison disappears.
  await page.locator('#category-select').selectOption('Normal')
  await expect(zeroFuel).toHaveCount(0)
  await expect(takeoff).toHaveText('Below MTOM by 136.0 kg')
  await expectZfmInsideDrawnEnvelope(page)
})

// Moment graph in a kg-in profile: envelope moments in kg·in are drawn in kg·m with the SI
// points. Synthetic vectors only: BEM 600 kg at 40 in + payload at 38 in; envelope
// 20000–50000 kg·in = 508–1270 kg·m, 500–900 kg.
test('kg-in moment envelope and calculated points share kg·m axes', async ({ page }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()

  const base = testPohAircraft()
  const envelope = [
    { mass: 500, armOrMoment: 20000 }, { mass: 900, armOrMoment: 20000 },
    { mass: 900, armOrMoment: 50000 }, { mass: 500, armOrMoment: 50000 },
  ]
  const profile = {
    ...base, id: '00000000-0000-4000-a000-000000005231', registration: 'D-MOMI', sourceUnit: 'kg-in',
    performanceProfiles: [],
    weighingReports: [{ bem: 600, emptyCg: 40, weighingDate: '2026-01-01', validFrom: '2026-01-01' }],
    loadPoints: [{
      name: 'Synthetic payload', kind: 'occupant', occupancy: 'required',
      arm: 38, armLookup: [], operationalLimit: 300, defaultQuantity: 0, unit: 'kg',
      allowableCategories: null, fuelTank: null,
    }],
    certificationCategories: [
      { category: 'Normal', mtom: 900, maxZeroFuelMass: null, graphType: 'moment', envelope },
    ],
  }
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-moment.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
  })
  await expect(page.getByRole('button', { name: 'Verify D-MOMI', exact: true })).toBeVisible()
  await page.goto('/mass-balance')

  const picker = page.getByLabel('Select aircraft', { exact: true })
  const option = picker.locator('option').filter({ hasText: 'D-MOMI' }).first()
  await picker.selectOption((await option.getAttribute('value'))!)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()

  const input = page.locator('#station-0')
  await input.fill('100') // ZFM 700 kg, moment 27800 kg·in = 706.12 kg·m
  await input.blur()
  await expect(page.getByTestId('takeoff-limit-difference')).toHaveText('Below MTOM by 200.0 kg')
  await expect(page.getByText('CG Moment (kg·m)', { exact: true })).toBeVisible()
  await expectZfmInsideDrawnEnvelope(page)
  await expect(page.locator('.notification--critical')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('moment-kg-in.png'), fullPage: true })
  await info.attach('moment-kg-in', { path: info.outputPath('moment-kg-in.png'), contentType: 'image/png' })
})
