import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic arithmetic only, not POH/AFM data and no aircraft validation. BEM 560 kg at 2 m
// (1120 kg·m); lookup tank holds total moments F(0)=0, F(10)=10, F(30)=60, F(50)=150 kg·m at
// 30 kg; fixed tank 20 kg at 1 m. Takeoff 610 kg, 1200 kg·m. With 10 kg unusable in the lookup
// tank, M&B adds F(30) − F(10) = 50: takeoff 600 kg, 1190 kg·m.
function profile(registration: string, unusable: number) {
  const p = testPohAircraft()
  const tank = (
    name: string,
    arm: number | null,
    quantity: number,
    order: [number, number],
    unusableFuel = 0,
  ) => ({
    name,
    kind: 'fuel',
    arm,
    armLookup:
      arm === null
        ? [
            { massOrVolume: 0, moment: 0 },
            { massOrVolume: 10, moment: 10 },
            { massOrVolume: 30, moment: 60 },
            { massOrVolume: 50, moment: 150 },
          ]
        : [],
    operationalLimit: null,
    defaultQuantity: quantity,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: {
      unusableFuel,
      permissibleFuelTypes: ['AvGas 100LL'],
      burnSequences: [
        { sequenceName: 'Lookup first', ordinalPosition: order[0] },
        { sequenceName: 'Fixed first', ordinalPosition: order[1] },
      ],
    },
  })
  return {
    ...p,
    id: `00000000-0000-4000-a000-00000000614${unusable ? 2 : 1}`,
    registration,
    sourceUnit: 'kg-m',
    performanceProfiles: [],
    weighingReports: [
      { bem: 560, emptyCg: 2, weighingDate: '2026-01-01', validFrom: '2026-01-01' },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 1000,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { mass: 500, armOrMoment: 0 },
          { mass: 1000, armOrMoment: 0 },
          { mass: 1000, armOrMoment: 4 },
          { mass: 500, armOrMoment: 4 },
        ],
      },
    ],
    loadPoints: [tank('Lookup tank', null, 30, [1, 2], unusable), tank('Fixed tank', 1, 20, [2, 1])],
  }
}

// Runs in both configured viewport projects (390 and 1440 px).
// Expected CG strings are [lookup first 10 kg, fixed first 10 kg, fixed first 40 kg, 0 kg, empty lookup tank].
const cases = [
  { unusable: 0, registration: 'D-MIXED', cg: ['1.958', '1.983', '1.982', '1.967', '1.982'] },
  { unusable: 10, registration: 'D-MIXU', cg: ['1.975', '2', '2', '1.983', '1.982'] },
] as const
for (const { unusable, registration, cg: expected } of cases) {
  test(`mixed-geometry arrival CG with ${unusable} kg unusable online and cached offline`, async ({ page, context }, info) => {
    const width = page.viewportSize()!.width
    const label = String(width)
    const shot = async (name: string) => {
      const path = info.outputPath(`${name}-${unusable}-${label}.png`)
      await page.screenshot({ path, fullPage: true })
      await info.attach(`${name}-${unusable}-${label}`, { path, contentType: 'image/png' })
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
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: `synthetic-${registration}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'aerodash-aircraft',
          version: 1,
          profile: profile(registration, unusable),
        }),
      ),
    })
    await expect(page.getByRole('button', { name: `Verify ${registration}`, exact: true })).toBeVisible()
    await page.goto('/mass-balance')
    const picker = page.getByLabel('Select aircraft', { exact: true })
    const option = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await option.getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()

    const card = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
    const cg = card.getByTestId('arrival-cg')
    const sequence = card.getByLabel('Arrival CG burn sequence')
    const lookupTank = page.locator('#station-0')
    const run = async () => {
      await card.getByLabel('Planning method').selectOption('direct')
      const direct = card.getByLabel('Trip Fuel (kg)', { exact: true })
      await direct.fill('10')
      await expect(card).toContainText('Choose an explicit named burn sequence')
      await expect(cg).toHaveCount(0)
      await sequence.selectOption('Lookup first')
      await expect(cg).toHaveText(`${expected[0]} m`)
      await sequence.selectOption('Fixed first')
      await expect(cg).toHaveText(`${expected[1]} m`)
      await direct.fill('40')
      await expect(cg).toHaveText(`${expected[2]} m`)
      await direct.fill('0')
      await expect(cg).toHaveText(`${expected[3]} m`)
      await direct.fill('51')
      await expect(cg).toHaveCount(0)
      await direct.fill('10')
      await lookupTank.fill(String(unusable))
      await lookupTank.blur()
      await expect(cg).toHaveText(`${expected[4]} m`) // only the fixed tank has usable fuel
    }
    await run()
    await shot('mixed-arrival-cg')
    await lookupTank.fill('30')
    await lookupTank.blur()
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
    await card.getByLabel('Planning method').selectOption('direct')
    await card.getByLabel('Trip Fuel (kg)', { exact: true }).fill('10')
    await expect(sequence).toHaveValue('')
    await expect(cg).toHaveCount(0)
    await sequence.selectOption('Lookup first')
    await expect(cg).toHaveText(`${expected[0]} m`)
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width)
    await shot('mixed-arrival-cg-offline')
    await context.setOffline(false)
  })
}
