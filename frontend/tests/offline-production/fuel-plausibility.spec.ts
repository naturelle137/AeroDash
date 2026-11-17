import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic fixture only; no operational aircraft data or source edits.
for (const lookup of [true, false]) {
  test(`required occupant warning coexists with raw ${lookup ? 'lookup' : 'fixed-arm'} fuel rejection online/offline`, async ({
    page,
    context,
  }, info) => {
    const profile = testPohAircraft()
    profile.registration = 'D-COEX'
    profile.status = 'draft'
    profile.sourceUnit = 'kg-m'
    profile.performanceProfiles = []
    profile.weighingReports = [
      { bem: 560, emptyCg: 2, weighingDate: '2026-01-01', validFrom: '2026-01-01' },
    ]
    profile.certificationCategories = [
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
    ]
    profile.loadPoints = [
      {
        name: 'Tank',
        kind: 'fuel',
        arm: lookup ? null : 3,
        armLookup: lookup
          ? [
              { massOrVolume: 0, moment: 0 },
              { massOrVolume: 50, moment: 150 },
            ]
          : [],
        operationalLimit: null,
        defaultQuantity: 30,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
      },
      {
        name: 'Pilot',
        kind: 'occupant',
        occupancy: 'required',
        arm: 2,
        armLookup: [],
        operationalLimit: null,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
      {
        name: 'Baggage',
        kind: 'baggage',
        arm: 2,
        armLookup: [],
        operationalLimit: 100,
        defaultQuantity: 120,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ]
    await page.goto('/fleet')
    await page.getByTestId('disclaimer-gate-accept').click()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-coexistence.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.getByRole('button', { name: 'Verify D-COEX', exact: true })).toBeVisible()
    await page.goto('/mass-balance')
    const picker = page.getByLabel('Select aircraft', { exact: true })
    await picker.selectOption(
      (await picker.locator('option').filter({ hasText: 'D-COEX' }).getAttribute('value'))!,
    )
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
    const tank = page.locator('#station-0')
    const pilot = page.locator('#station-1')
    const summary = page.getByRole('region', { name: 'Calculation results' })
    const occupant = page
      .getByRole('alert')
      .filter({ hasText: 'Implausible mass on required station: Pilot' })
    const error = page
      .getByRole('alert')
      .filter({ hasText: 'Invalid input: Tank (BELOW_UNUSABLE)' })
    const preview = page.getByRole('dialog', { name: 'Briefing Pack preview', exact: true })
    const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
    const notices = async () => {
      await expect(
        page.getByRole('alert').filter({ hasText: 'Station 2 limit exceeded' }),
      ).toHaveCount(1)
      await expect(page.getByRole('alert').filter({ hasText: 'Draft Profile Active' })).toHaveCount(
        1,
      )
    }
    const blocked = async () => {
      await expect(error).toBeVisible()
      await expect(summary).toHaveCount(0)
      for (const key of ['tom', 'lm', 'zfm'])
        await expect(page.getByTestId(`cg-point-label-${key}`)).toHaveCount(0)
      await action.click()
      await expect(preview).toHaveCount(0)
      await expect(page.locator('#briefing-eligibility')).toContainText('not eligible')
      await notices()
    }
    const shot = async (name: string) => {
      const path = info.outputPath(`${name}.png`)
      await page.screenshot({ path, fullPage: true })
      await info.attach(name, { path, contentType: 'image/png' })
    }
    for (const offline of [false, true]) {
      if (offline) {
        await expect
          .poll(() => page.evaluate(() => localStorage.getItem('aerodash:session:payload')))
          .toContain('"weight":9')
        await context.setOffline(true)
        expect((await page.reload())?.fromServiceWorker()).toBe(true)
        await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
      } else {
        await tank.fill('9')
        await tank.blur()
      }
      await expect(occupant).toHaveCount(1)
      await blocked()
      await shot(`${offline ? 'offline' : 'online'}-coexistence`)
      await pilot.fill('80')
      await pilot.blur()
      await expect(occupant).toHaveCount(0)
      await blocked()
      await pilot.fill('0')
      await pilot.blur()
      await tank.fill('30')
      await tank.blur()
      await expect(error).toHaveCount(0)
      await expect(summary).toBeVisible()
      await expect(occupant).toHaveCount(1)
      await notices()
      await pilot.fill('80')
      await pilot.blur()
      await expect(occupant).toHaveCount(0)
      await expect(summary).toBeVisible()
      await notices()
      await action.click()
      await expect(preview).toBeVisible()
      await expect(preview).not.toContainText('WARN-UQ-001')
      await shot(`${offline ? 'offline' : 'online'}-recovered`)
      await page.keyboard.press('Escape')
      await pilot.fill('0')
      await pilot.blur()
      await tank.fill('9')
      await tank.blur()
    }
    await context.setOffline(false)
  })
}
