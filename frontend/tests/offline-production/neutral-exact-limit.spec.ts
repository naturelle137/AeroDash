import { expect, test, type Locator, type Page } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic software vectors in kg (BEM 500 kg + payload + fuel, no unusable fuel); not aircraft data.
// Normal MTOM 1000 / MZFM 900 kg, Utility MTOM 1100 / MZFM 950 kg; the draft profile has no MZFM.
test('neutral within-limit state and raw exact-limit cross-check, cached offline', async ({ page, context }, info) => {
  test.setTimeout(120_000)
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const base = testPohAircraft()
  base.performanceProfiles = []
  base.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [],
      operationalLimit: 1000, defaultQuantity: 0, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 300, defaultQuantity: 0,
      unit: 'kg', allowableCategories: null,
      fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  const normal = { ...base.certificationCategories[0]!, category: 'Normal', mtom: 1000, maxZeroFuelMass: 900 }
  const utility = { ...normal, category: 'Utility', mtom: 1100, maxZeroFuelMass: 950 }
  const profiles = [
    { ...base, registration: 'D-EXAV', id: '00000000-0000-4000-a000-000000000527', certificationCategories: [normal, utility] },
    { ...base, registration: 'D-EXAN', id: '00000000-0000-4000-a000-000000005271', status: 'draft' as const,
      certificationCategories: [{ ...normal, maxZeroFuelMass: null }] },
  ]
  for (const profile of profiles) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-exact.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.getByRole('button', { name: `Verify ${profile.registration}`, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Verify D-EXAV', exact: true }).click()
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
  const payload = page.locator('#station-0')
  const fuel = page.locator('#station-1')
  async function load(p: string, f: string) {
    await payload.fill(p)
    await payload.blur()
    await fuel.fill(f)
    await fuel.blur()
  }
  const takeoff = page.getByTestId('takeoff-limit-difference')
  const zeroFuel = page.getByTestId('zero-fuel-limit-difference')
  const prompt = page.getByTestId('exact-limit-cross-check')
  const chart = page.getByRole('img', { name: /CG Envelope Chart/ })
  const card = page.getByRole('region', { name: 'Mass and Balance', exact: true })
  const banner = card.locator('.state-banner')
  const takeoffValue = page.locator('.result-summary__value').first()
  async function shot(name: string) {
    await page.locator('.mb-layout__results').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' })
  }
  async function noOverflow(target: Locator) {
    const box = (await target.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  }

  // Neutral calculated-inside state; 979 and 981 kg render identically (no 98 % band).
  await pick('D-EXAV')
  await load('390', '89')
  await expect(takeoff).toHaveText('Below MTOM by 21.0 kg')
  await expect(chart).toHaveAttribute('aria-label', /inside entered envelope \(calculated state only\), TOM 979\.0 kg/)
  await expect(banner).toContainText('Mass & Balance within entered limits — verify against POH/AFM')
  await expectNotSuccessGreen(page, banner)
  await expect(prompt).toHaveCount(0)
  const at979 = { value: await takeoffValue.getAttribute('class'), banner: await banner.getAttribute('class') }
  await shot('neutral-979')
  await load('390', '91')
  await expect(takeoff).toHaveText('Below MTOM by 19.0 kg')
  expect({ value: await takeoffValue.getAttribute('class'), banner: await banner.getAttribute('class') }).toEqual(at979)
  await expect(page.getByText(/approaching/i)).toHaveCount(0)
  await expect(prompt).toHaveCount(0)

  // Rounded display equals the limit but the raw mass does not: no exact prompt.
  await load('399.96', '100') // TOM 999.96, ZFM 899.96
  await expect(takeoff).toHaveText('Below MTOM by less than 0.1 kg')
  await expect(zeroFuel).toHaveText('Below MZFM by less than 0.1 kg')
  await expect(takeoffValue).toHaveText('1000.0')
  await expect(prompt).toHaveCount(0)

  // Raw equality: MTOM only, then both limits in one prompt.
  await load('390', '110') // TOM 1000, ZFM 890
  await expect(prompt).toHaveText('Exactly at MTOM: no arithmetic mass difference remains. Re-check the loading and the entered category/profile limit against the POH/AFM.')
  await load('400', '100')
  await expect(prompt).toHaveCount(1)
  await expect(prompt).toHaveText(/^\s*Exactly at MTOM and MZFM: no arithmetic mass difference remains\./)
  await expect(takeoff).toHaveText('Exactly at MTOM')
  await expect(zeroFuel).toHaveText('Exactly at MZFM')
  await expect(banner).toContainText('within entered limits')
  await noOverflow(prompt)
  await shot('exact-both')

  // Above MTOM: critical notices, shape and raw exceedance; MZFM still exact.
  await load('400', '100.04')
  await expect(takeoff).toHaveText('Above MTOM by 0.1 kg')
  await expect(chart).toHaveAttribute('aria-label', /CRITICAL, TOM 1000\.0 kg/)
  await expect(page.locator('.notification--critical').first()).toBeVisible()
  await expect(page.locator('.result-summary__sr-only')).toHaveText('above limit')
  await expect(prompt).toHaveText(/^\s*Exactly at MZFM: /)
  await shot('critical-above-mtom')

  // MZFM raw vectors.
  await load('399.96', '0')
  await expect(zeroFuel).toHaveText('Below MZFM by less than 0.1 kg')
  await expect(prompt).toHaveCount(0)
  await load('400.04', '0')
  await expect(zeroFuel).toHaveText('Above MZFM by 0.1 kg')
  await expect(prompt).toHaveCount(0)

  // Category switch recomputes the relation; switching back restores it.
  await load('400', '100')
  await expect(prompt).toHaveCount(1)
  await page.locator('#category-select').selectOption('Utility')
  await expect(prompt).toHaveCount(0)
  await expect(takeoff).toHaveText('Below MTOM by 100.0 kg')
  await expect(zeroFuel).toHaveText('Below MZFM by 50.0 kg')
  await page.locator('#category-select').selectOption('Normal')
  await expect(prompt).toHaveText(/^\s*Exactly at MTOM and MZFM: /)

  // Invalid input suppresses the old equality; correction restores the current one.
  await payload.fill('-5')
  await payload.blur()
  await expect(prompt).toHaveCount(0)
  await expect(takeoff).toHaveCount(0)
  await expect(card.locator('.banner--success')).toHaveCount(0)
  await shot('invalid-input')
  await payload.fill('400')
  await payload.blur()
  await expect(prompt).toHaveCount(1)

  // Dark theme: the neutral state and prompt stay non-green and readable.
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNotSuccessGreen(page, banner)
  await shot('exact-both-dark')
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click()

  // Pending acknowledgement for a draft profile shows no old equality; the new profile has no MZFM.
  await pick('D-EXAN')
  await expect(page.getByRole('button', { name: 'Continue anyway', exact: true })).toBeVisible()
  await expect(prompt).toHaveCount(0)
  await expect(takeoff).toHaveCount(0)
  await shot('pending-acknowledgement')
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await expect(takeoff).toHaveText('Below MTOM by 500.0 kg')
  await load('500', '0')
  await expect(takeoff).toHaveText('Exactly at MTOM')
  await expect(zeroFuel).toHaveCount(0)
  await expect(prompt).toHaveText(/^\s*Exactly at MTOM: /)
  await expect(prompt).not.toContainText('MZFM')

  // Cached offline reload: production service worker serves the app; re-enter loads.
  await context.setOffline(true)
  const reopened = await page.reload()
  expect(reopened?.fromServiceWorker()).toBe(true)
  await pick('D-EXAV')
  await load('400', '100')
  await expect(prompt).toHaveCount(1)
  await expect(prompt).toHaveText(/^\s*Exactly at MTOM and MZFM: /)
  await expect(chart).toHaveAttribute('aria-label', /inside entered envelope \(calculated state only\), TOM 1000\.0 kg/)
  await noOverflow(page.locator('.result-summary'))
  await shot('offline-exact-both')
  await load('400', '100.04')
  await expect(page.locator('.notification--critical').first()).toBeVisible()
  await shot('offline-critical')
  await context.setOffline(false)
})

/** The banner, its notification and the chart path must not use the theme's success green. */
async function expectNotSuccessGreen(page: Page, banner: Locator) {
  const colours = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-success)'
    document.body.append(probe)
    const success = getComputedStyle(probe).color
    probe.style.color = 'var(--color-success-bg)'
    const successBg = getComputedStyle(probe).color
    probe.remove()
    return { success, successBg }
  })
  const used = await banner.evaluate((el) => {
    const note = el.querySelector('.notification--success')!
    const path = document.querySelector('.cg-chart path')
    return [
      getComputedStyle(el).backgroundColor,
      getComputedStyle(el).borderTopColor,
      getComputedStyle(note).color,
      path?.getAttribute('stroke') ?? '',
    ]
  })
  for (const colour of used) {
    expect(colour).not.toBe(colours.success)
    expect(colour).not.toBe(colours.successBg)
    expect(colour).not.toMatch(/#2e7d32|#388e3c|#a5d6a7/i)
  }
}
