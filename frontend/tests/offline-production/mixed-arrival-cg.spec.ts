import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic arithmetic only, not POH/AFM data and no aircraft validation. BEM 560 kg at 2 m
// (1120 kg·m); lookup tank holds total moments F(0)=0, F(10)=10, F(30)=60, F(50)=150 kg·m at
// 30 kg; fixed tank 20 kg at 1 m. Takeoff 610 kg, 1200 kg·m.
function profile() {
  const p = testPohAircraft()
  const tank = (name: string, arm: number | null, quantity: number, order: [number, number]) => ({
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
      unusableFuel: 0,
      permissibleFuelTypes: ['AvGas 100LL'],
      burnSequences: [
        { sequenceName: 'Lookup first', ordinalPosition: order[0] },
        { sequenceName: 'Fixed first', ordinalPosition: order[1] },
      ],
    },
  })
  return {
    ...p,
    id: '00000000-0000-4000-a000-000000006141',
    registration: 'D-MIXED',
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
    loadPoints: [tank('Lookup tank', null, 30, [1, 2]), tank('Fixed tank', 1, 20, [2, 1])],
  }
}

// Runs in both configured viewport projects (390 and 1440 px).
{
  test('mixed-geometry arrival CG online and cached offline', async ({ page, context }, info) => {
    const width = page.viewportSize()!.width
    const label = String(width)
    const shot = async (name: string) => {
      const path = info.outputPath(`${name}-${label}.png`)
      await page.screenshot({ path, fullPage: true })
      await info.attach(`${name}-${label}`, { path, contentType: 'image/png' })
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
      name: 'synthetic-mixed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile: profile() }),
      ),
    })
    await expect(page.getByRole('button', { name: 'Verify D-MIXED', exact: true })).toBeVisible()
    await page.goto('/mass-balance')
    const picker = page.getByLabel('Select aircraft', { exact: true })
    const option = picker.locator('option').filter({ hasText: 'D-MIXED' }).first()
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
      await expect(cg).toHaveText('1.958 m') // 1175 / 600
      await sequence.selectOption('Fixed first')
      await expect(cg).toHaveText('1.983 m') // 1190 / 600
      await direct.fill('40')
      await expect(cg).toHaveText('1.982 m') // 1130 / 570
      await direct.fill('0')
      await expect(cg).toHaveText('1.967 m') // 1200 / 610
      await direct.fill('51')
      await expect(cg).toHaveCount(0)
      await direct.fill('10')
      await lookupTank.fill('0')
      await lookupTank.blur()
      await expect(cg).toHaveText('1.982 m') // empty lookup tank, 20 kg fixed: 1130 / 570
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
    await expect(cg).toHaveText('1.958 m')
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width)
    await shot('mixed-arrival-cg-offline')
    await context.setOffline(false)
  })
}
