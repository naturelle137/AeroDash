import { mkdirSync } from 'node:fs'
import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

const OUT = process.env.THEME_AUDIT_DIR ?? 'test-results/theme-audit'
const STORAGE_KEY = 'aerodash.disclaimer.ack.v1'
const WIDTHS = [{ w: 390, h: 844 }, { w: 1440, h: 1000 }]

// Synthetic data: wiring/visual check only, not operational performance.
async function seedAircraft(page: Page): Promise<void> {
  await page.goto('/fleet')
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
}

for (const theme of ['light', 'dark'] as const) {
  for (const { w, h } of WIDTHS) {
    test(`views ${theme} ${w}px`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true })
      await page.setViewportSize({ width: w, height: h })
      const version = (await import('../../package.json', { with: { type: 'json' } })).default.version
      const baseline = version.split('.').slice(0, 2).join('.')
      await page.addInitScript(({ key, version, baseline, theme }) => {
        localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, acceptedVersion: version, acceptedBaseline: baseline, acceptedAt: Date.now() }))
        localStorage.setItem('aerodash-theme', theme)
      }, { key: STORAGE_KEY, version, baseline, theme })
      const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, fullPage: true })

      await seedAircraft(page)
      await shot('fleet')

      await page.goto('/mass-balance')
      const picker = page.getByLabel('Select aircraft', { exact: true })
      await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).getAttribute('value'))!)
      for (const [name, value] of [['Synthetic payload', '100'], ['Synthetic tank', '50']]) {
        const input = page.getByRole('textbox', { name, exact: true })
        await input.fill(value!)
        await input.blur()
      }
      await shot('mass-balance')

      const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
      await fuel.getByLabel('Planning method').selectOption('direct')
      await fuel.getByLabel('Trip Fuel (kg)').fill('20')
      await fuel.scrollIntoViewIfNeeded()
      await fuel.screenshot({ path: `${OUT}/fuel-${theme}-${w}.png` })

      const performance = page.getByRole('region', { name: 'Performance', exact: true })
      const runway = performance.getByRole('form', { name: 'Manual runway', exact: true })
      await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic field')
      await runway.getByLabel('Runway designator', { exact: true }).fill('18')
      await runway.getByLabel('TORA — takeoff run available', { exact: true }).fill('1000')
      await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('900')
      await runway.getByLabel('Field elevation', { exact: true }).fill('1000')
      await runway.getByLabel('Surface type', { exact: true }).selectOption('paved')
      await runway.getByLabel('Surface condition', { exact: true }).selectOption('dry')
      await runway.getByRole('button', { name: 'Save runway inputs', exact: true }).click()
      await performance.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
      await performance.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
      await performance.getByLabel('Temperature (°C)', { exact: true }).fill('10')
      await performance.scrollIntoViewIfNeeded()
      await performance.screenshot({ path: `${OUT}/performance-${theme}-${w}.png` })

      await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
      const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
      await expect(preview.getByRole('heading', { name: 'M&B results' })).toBeVisible()
      await preview.screenshot({ path: `${OUT}/briefing-pack-${theme}-${w}.png` })
      await page.keyboard.press('Escape')

      await page.goto('/weather')
      await shot('weather')
    })
  }
}
