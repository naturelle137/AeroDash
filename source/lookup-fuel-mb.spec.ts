import { expect, test, type Page } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic software vectors only, not POH/AFM data. BEM 560 kg at 2 m (1120 kg·m) includes
// 10 kg unusable fuel; the lookup holds TOTAL tank moments (0,0),(10,10),(30,60),(50,150)
// in kg / kg·m. M&B adds F(q) − F(u):
//   q50 → 600 kg, 1260 kg·m, 2.100 m   (legacy (q − u)·F(q)/q: 1240, 2.067 m)
//   q30 → 580 kg, 1170 kg·m, 2.017 m   (legacy 1160, 2.000 m)
//   q10 → 560 kg, 1120 kg·m, 2.000 m   (zero usable fuel)
// The USG / lb·in profile carries the same curve: axis 3.785411784 × 0.72 kg per USG,
// moments in lb·in (0.45359237 × 0.0254 kg·m each).
const KG_KNOTS = [
  [0, 0],
  [10, 10],
  [30, 60],
  [50, 150],
] as const
const USG_KG = 3.785411784 * 0.72
const LB_IN = 0.45359237 * 0.0254

function lookupProfile(registration: string, id: string, imperial: boolean) {
  const base = testPohAircraft()
  const lb = (kg: number) => kg / 0.45359237
  const category = (name: 'Normal' | 'Utility', graphType: 'arm' | 'moment', hi: number) => ({
    category: name,
    mtom: imperial ? lb(1000) : 1000,
    maxZeroFuelMass: null,
    graphType,
    envelope: [
      { mass: imperial ? lb(500) : 500, armOrMoment: 0 },
      { mass: imperial ? lb(1000) : 1000, armOrMoment: 0 },
      { mass: imperial ? lb(1000) : 1000, armOrMoment: hi },
      { mass: imperial ? lb(500) : 500, armOrMoment: hi },
    ],
  })
  return {
    ...base,
    id,
    registration,
    sourceUnit: imperial ? 'lb-in' : 'kg-m',
    performanceProfiles: [],
    weighingReports: [
      {
        bem: imperial ? lb(560) : 560,
        emptyCg: imperial ? 2 / 0.0254 : 2,
        weighingDate: '2026-01-01',
        validFrom: '2026-01-01',
      },
    ],
    loadPoints: [
      {
        name: 'Lookup tank',
        kind: 'fuel',
        arm: null,
        armLookup: KG_KNOTS.map(([kg, m]) =>
          imperial
            ? { massOrVolume: kg / USG_KG, moment: m / LB_IN }
            : { massOrVolume: kg, moment: m },
        ),
        operationalLimit: null,
        defaultQuantity: imperial ? 50 / USG_KG : 50,
        unit: imperial ? 'USG' : 'kg',
        allowableCategories: null,
        fuelTank: {
          unusableFuel: imperial ? 10 / USG_KG : 10,
          permissibleFuelTypes: ['AvGas 100LL'],
          burnSequences: [],
        },
      },
    ],
    // kg profile: arm limit 2.09 m and moment limit 1250 kg·m both lie between the
    // legacy and corrected q50 takeoff points, so the warning follows the correction.
    certificationCategories: imperial
      ? [category('Normal', 'moment', 4000 / LB_IN)]
      : [category('Normal', 'arm', 2.09), category('Utility', 'moment', 1250)],
  }
}

async function chartPoint(page: Page, key: 'tom' | 'lm') {
  const points = (await page.getByTestId('cg-envelope-polygon').getAttribute('points'))!
    .split(' ')
    .map((pair) => pair.split(',').map(Number) as [number, number])
  const label = page.getByTestId(`cg-point-label-${key}`)
  const x = Number(await label.getAttribute('x')) - 9
  const xs = points.map(([px]) => px)
  return (x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs))
}

test('lookup fuel M&B uses total-moment differences on screen, chart, print and offline', async ({
  page,
  context,
}, info) => {
  async function shot(name: string) {
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' })
  }
  // Viewport capture centred on the M&B error so fixed navigation/toasts cannot cover it.
  async function errorShot(name: string) {
    const error = page.getByRole('alert').filter({ hasText: 'Invalid input: Lookup tank' })
    await error.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: info.outputPath(`${name}-error.png`) })
    await info.attach(`${name}-error`, {
      path: info.outputPath(`${name}-error.png`),
      contentType: 'image/png',
    })
  }
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
  for (const profile of [
    lookupProfile('D-LKG', '00000000-0000-4000-a000-000000005301', false),
    lookupProfile('N530US', '00000000-0000-4000-a000-000000005302', true),
    {
      ...lookupProfile('D-LOW', '00000000-0000-4000-a000-000000005303', false),
      loadPoints: lookupProfile('D-LOW', '', false).loadPoints.map((tank) => ({
        ...tank,
        defaultQuantity: 0,
      })),
    },
  ]) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-lookup-fuel.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(
      page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true }),
    ).toBeVisible()
  }
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  async function select(registration: string) {
    const option = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await option.getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  const tank = page.locator('#station-0')
  async function load(value: string) {
    await tank.fill(value)
    await tank.blur()
  }
  const summary = page.getByRole('region', { name: 'Calculation results' })
  const takeoffCg = summary.locator('.result-summary__item', { hasText: 'CG (Takeoff)' })
  const takeoffMass = summary.locator('.result-summary__item', { hasText: 'Takeoff Mass' })
  const critical = page.getByRole('alert').filter({ hasText: 'CG Out of Envelope' })
  const action = page.getByRole('button', { name: 'M&B print preview', exact: true })
  const preview = page.getByRole('dialog', { name: 'M&B print preview', exact: true })
  const category = page.locator('#category-select')

  await select('D-LKG')
  // q50: corrected 2.100 m lies beyond the 2.09 m arm limit (legacy 2.067 m did not).
  await expect(takeoffMass).toContainText('600.0')
  await expect(takeoffCg).toContainText('2.100')
  await expect(critical).toBeVisible()
  await expect(action).toBeDisabled()
  await shot('lookup-q50-arm-critical')

  await load('30')
  await expect(takeoffMass).toContainText('580.0')
  await expect(takeoffCg).toContainText('2.017')
  await expect(critical).toHaveCount(0)
  // Arm axis 0–2.09 m: TOM at 2.017 m, all-usable-burned point at BEM 2.000 m.
  expect(await chartPoint(page, 'tom')).toBeCloseTo(2.017 / 2.09, 2)
  expect(await chartPoint(page, 'lm')).toBeCloseTo(2 / 2.09, 2)
  await shot('lookup-q30-arm-chart')

  await action.click()
  await expect(preview).toContainText('580.0 kg [UNVERIFIED]')
  await expect(preview).toContainText('2.017 m [UNVERIFIED]')
  await expect(preview).toContainText('560.0 kg [UNVERIFIED]')
  await expect(preview).toContainText('2.000 m [UNVERIFIED]')
  await shot('lookup-q30-print')
  // Changing the tank load while the preview is open invalidates the snapshot.
  await tank.evaluate((element: HTMLInputElement) => {
    element.value = '9'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(preview).toContainText('Preview invalidated')
  await expect(preview).not.toContainText('2.017 m')
  await page.keyboard.press('Escape')

  // A typed load below unusable fuel is refused by the field and blocks the result
  // visibly: no summary, no CG markers, no print.
  await load('9')
  await expect(page.getByText(/Invalid input: Lookup tank \(/)).toBeVisible()
  await expect(summary).toHaveCount(0)
  await expect(page.getByTestId('cg-point-label-tom')).toHaveCount(0)
  await expect(action).toBeDisabled()
  await shot('lookup-below-unusable-blocked')
  await errorShot('lookup-below-unusable-blocked')

  await load('60')
  await expect(page.getByText(/Invalid input: Lookup tank \(LOOKUP_OUT_OF_RANGE\)/)).toBeVisible()
  await expect(summary).toHaveCount(0)
  await expect(page.getByTestId('cg-point-label-tom')).toHaveCount(0)
  await shot('lookup-out-of-range-blocked')
  await errorShot('lookup-out-of-range-blocked')

  // q = u is valid zero usable fuel; then correction restores the corrected point.
  await load('10')
  await expect(takeoffMass).toContainText('560.0')
  await expect(takeoffCg).toContainText('2.000')
  await load('30')
  await expect(takeoffCg).toContainText('2.017')

  // Moment graph (kg·m 0–1250): 1170 inside; q50 1260 outside (legacy 1240 was inside).
  await category.selectOption('Utility')
  await expect(page.getByText('CG Moment (kg·m)', { exact: true })).toBeVisible()
  expect(await chartPoint(page, 'tom')).toBeCloseTo(1170 / 1250, 2)
  await expect(critical).toHaveCount(0)
  await load('50')
  await expect(critical).toBeVisible()
  await shot('lookup-q50-moment-critical')
  await category.selectOption('Normal')
  await expect(takeoffCg).toContainText('2.100')

  // Loading reset returns to max(default, unusable) = 50 kg.
  await load('9')
  await expect(summary).toHaveCount(0)
  await page.getByRole('button', { name: 'Reset Payload', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(tank).toHaveValue('50')
  await expect(takeoffCg).toContainText('2.100')

  // Fuel planning keeps nonzero-unusable trip arrival CG unsupported but shows arrival mass.
  await load('30')
  const card = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  await card.getByLabel('Planning method').selectOption('direct')
  await card.getByLabel('Trip Fuel (kg)', { exact: true }).fill('10')
  const arrival = page.getByRole('region', { name: 'Estimated trip arrival', exact: true })
  await expect(arrival).toContainText('570 kg')
  await expect(card.getByTestId('arrival-cg')).toHaveCount(0)
  await expect(card).toContainText('exactly zero unusable fuel')
  await page.getByLabel('Include current fuel plan', { exact: true }).check()
  await action.click()
  const section = preview.getByRole('region', {
    name: 'Current fuel plan and estimated trip arrival',
  })
  await expect(section).toContainText('Estimated arrival mass')
  await expect(section).toContainText('exactly zero unusable fuel')
  await expect(preview).toContainText('2.017 m [UNVERIFIED]')
  await shot('lookup-print-fuel-section')
  await preview.getByRole('button', { name: 'Back to preparation' }).click()

  // Imperial USG tank with lb·in moments on a lb·in moment envelope (0–4000 kg·m in SI).
  await select('N530US')
  await expect(takeoffCg).toContainText('2.100')
  await load(String(30 / USG_KG))
  await expect(takeoffMass).toContainText('580.0')
  await expect(takeoffCg).toContainText('2.017')
  await expect(page.getByText('CG Moment (kg·m)', { exact: true })).toBeVisible()
  expect(await chartPoint(page, 'tom')).toBeCloseTo(1170 / 4000, 2)
  await shot('lookup-usg-lb-in-moment')
  await load('1')
  await expect(page.getByText(/Invalid input: Lookup tank \(/)).toBeVisible()
  await expect(summary).toHaveCount(0)

  // A profile whose default load is below unusable fuel is blocked, never coerced to zero usable.
  await select('D-LOW')
  await expect(page.getByText(/Invalid input: Lookup tank \(BELOW_UNUSABLE\)/)).toBeVisible()
  await expect(summary).toHaveCount(0)
  await expect(page.getByTestId('cg-point-label-tom')).toHaveCount(0)
  await shot('lookup-default-below-unusable')
  await errorShot('lookup-default-below-unusable')
  await load('30')
  await expect(takeoffCg).toContainText('2.017')

  // Profile change resets the loading to the selected profile's default.
  await select('D-LKG')
  await expect(tank).toHaveValue('50')
  await expect(takeoffCg).toContainText('2.100')
  await load('30')
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem('aerodash:session:payload')?.includes('"weight":30') ?? false,
      ),
    )
    .toBe(true)

  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await expect(page.getByText('Browser offline')).toBeVisible()
  await expect(takeoffCg).toContainText('2.017')
  await load('9')
  await expect(page.getByText(/Invalid input: Lookup tank \(/)).toBeVisible()
  await expect(summary).toHaveCount(0)
  await load('30')
  await expect(takeoffCg).toContainText('2.017')
  await action.click()
  await expect(preview).toContainText('2.017 m [UNVERIFIED]')
  await shot('lookup-offline-print')
  await page.keyboard.press('Escape')
  await context.setOffline(false)
})
