import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic software vectors only; browser PDFs are internal pagination evidence.
test('optional current fuel in cached offline native print with synchronous stale guards', async ({ page, context }, info) => {
  test.setTimeout(120_000)
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.performanceProfiles = []
  profile.status = 'draft'
  profile.loadPoints = [{ name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [],
    operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null,
    fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } }]
  // Long station warnings force real multi-page output with repeated headers.
  profile.loadPoints.push(...Array.from({ length: 12 }, (_, i) => ({
    name: `Synthetic empty seat ${i + 1}: ${'Long warning pagination text '.repeat(5)}`,
    kind: 'occupant' as const, occupancy: 'required' as const, arm: 1, armLookup: [],
    operationalLimit: 100, defaultQuantity: 0, unit: 'kg', allowableCategories: null, fuelTank: null,
  })))
  for (const registration of ['D-FUEL', 'D-VARY', 'D-MULTI']) {
    profile.registration = registration
    if (registration === 'D-VARY') {
      profile.id = '00000000-0000-4000-a000-000000000429'
      profile.loadPoints[0]!.arm = null
      profile.loadPoints[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 100, moment: 100 }]
    }
    if (registration === 'D-MULTI') {
      profile.id = '00000000-0000-4000-a000-000000000430'
      profile.loadPoints[0]!.arm = 1
      profile.loadPoints[0]!.armLookup = []
      profile.loadPoints.push({ ...structuredClone(profile.loadPoints[0]!), name: 'Synthetic second tank' })
      for (const [i, tank] of [profile.loadPoints[0]!, profile.loadPoints.at(-1)!].entries()) {
        tank.fuelTank!.burnSequences = [
          { sequenceName: 'A first', ordinalPosition: i + 1 },
          { sequenceName: 'B first', ordinalPosition: 2 - i },
          { sequenceName: 'Incomplete synthetic sequence', ordinalPosition: 1 },
        ]
      }
    }
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-fuel-print.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.getByRole('button', { name: `Verify ${registration}`, exact: true })).toBeVisible()
  }
  await page.goto('/mass-balance')
  async function select(registration: string) {
    const picker = page.getByLabel('Select aircraft', { exact: true })
    await picker.selectOption((await picker.locator('option').filter({ hasText: registration }).first().getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  await select('D-FUEL')
  const include = page.getByLabel('Include current fuel plan', { exact: true })
  const action = page.getByRole('button', { name: 'M&B print preview', exact: true })
  const preview = page.getByRole('dialog', { name: 'M&B print preview', exact: true })
  const section = preview.getByRole('region', { name: 'Current fuel plan and estimated trip arrival' })
  const method = page.getByLabel('Planning method')
  const rate = page.getByLabel('Planned average consumption (kg/h)')
  const trip = page.getByLabel('Planned flight duration (min)')
  const reserve = page.getByLabel('Reserve duration (min)')
  const direct = page.getByLabel('Trip Fuel (kg)', { exact: true })
  const back = preview.getByRole('button', { name: 'Back to preparation' })
  await expect(include).not.toBeChecked()
  await include.check()
  await expect(action).toBeDisabled()
  await expect(page.getByText('Fuel inclusion blocked:')).toContainText('Choose a planning method')
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await select('D-FUEL')
  await expect(include).not.toBeChecked()
  await expect(method).toHaveValue('')
  await method.selectOption('duration')
  await rate.fill('10'); await trip.fill('120'); await reserve.fill('300')
  await include.check()
  await action.click()
  await expect(section).toContainText('520 kg [UNVERIFIED]')
  await expect(section).toContainText('WARN-FE-001')
  await expect(section).toContainText('insufficient even for the reserve alone')
  await expect(section).toContainText('Fuel shortfall')
  await expect(section).toContainText('30 kg [UNVERIFIED]')
  await expect(section).toContainText('1 m [UNVERIFIED]')
  await page.evaluate(() => {
    document.documentElement.dataset.printEvents = '0'
    window.addEventListener('beforeprint', () => {
      document.documentElement.dataset.printEvents = String(Number(document.documentElement.dataset.printEvents) + 1)
    })
  })
  async function capture(name: string) {
    await preview.evaluate(element => element.parentElement!.scrollTo(0, 0))
    await page.screenshot({ path: info.outputPath(`${name}-screen.png`) })
    await section.evaluate(element => element.scrollIntoView({ block: 'center' }))
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(page.viewportSize()!.width)
    await page.screenshot({ path: info.outputPath(`${name}-fuel-screen.png`) })
    await preview.getByRole('button', { name: /^Print M&B/ }).click()
    await expect.poll(() => page.locator('html').getAttribute('data-print-events').then(Number)).toBeGreaterThan(0)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#app')).toBeHidden()
    await expect(section).toBeVisible()
    await page.screenshot({ path: info.outputPath(`${name}-print.png`), fullPage: true })
    await page.pdf({ path: info.outputPath(`${name}.pdf`), preferCSSPageSize: true })
    for (const [file, contentType] of [[`${name}-screen.png`, 'image/png'], [`${name}-fuel-screen.png`, 'image/png'], [`${name}-print.png`, 'image/png'], [`${name}.pdf`, 'application/pdf']]) {
      await info.attach(file!, { path: info.outputPath(file!), contentType: contentType! })
    }
    await page.emulateMedia({ media: 'screen' })
  }
  await capture('offline-duration-reserve-shortfall')
  await back.click()
  await expect(reserve).toHaveValue('300')
  await reserve.fill('0'); await trip.fill('240')
  await action.click()
  await expect(section).toContainText('Zero margin')
  await back.click()
  await trip.fill('241')
  await expect(action).toBeDisabled()
  await expect(page.getByText('Fuel inclusion blocked:')).toContainText('Trip fuel exceeds')
  await method.selectOption('direct')
  await expect(direct).toHaveValue('')
  for (const raw of ['', '-1', 'NaN', '1e2', '40.001']) {
    await direct.fill(raw)
    await expect(action).toBeDisabled()
  }
  await direct.fill('20')
  await action.click()
  await expect(section).toContainText('Direct Trip Fuel (kg)')
  await expect(section).not.toContainText('WARN-FE-001')
  await expect(section.getByRole('cell', { name: 'Total endurance', exact: true })).toHaveCount(0)
  await capture('offline-direct')
  // Dispatch input and invoke REAL native print in the same JavaScript turn.
  const guarded = await page.locator('#fe-direct-trip').evaluate((input: HTMLInputElement) => {
    input.value = '21'; input.dispatchEvent(new Event('input', { bubbles: true }))
    window.print()
    return document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')
  })
  expect(guarded).toBe('true')
  await expect(preview).toContainText('Preview invalidated')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.mb-print-sheet')).toBeHidden()
  await expect(page.locator('.mb-print-guard')).toBeVisible()
  await page.pdf({ path: info.outputPath('fuel-stale-blocked.pdf'), preferCSSPageSize: true })
  await page.emulateMedia({ media: 'screen' })
  await back.click()
  await expect(include).toBeChecked()
  await action.click()
  await method.evaluate((input: HTMLSelectElement) => {
    input.value = 'duration'; input.dispatchEvent(new Event('change', { bubbles: true })); window.print()
  })
  await expect(preview).toContainText('Preview invalidated')
  await back.click()
  await expect(action).toBeDisabled()
  await include.uncheck()
  await action.click()
  await expect(preview).toContainText('Mass & Balance only')
  await back.click()
  for (const registration of ['D-VARY', 'D-MULTI']) {
    await select(registration)
    for (const planning of ['duration', 'direct']) {
      await method.selectOption(planning)
      if (planning === 'duration') {
        await rate.fill('10'); await trip.fill('120'); await reserve.fill('30')
      } else await direct.fill('20')
      await include.check()
      await action.click()
      await expect(section).toContainText('Estimated arrival mass')
      await expect(section).toContainText(registration === 'D-VARY' ? 'Variable-arm tanks' : 'Choose an explicit named burn sequence')
      await capture(`${registration}-${planning}-unsupported`)
      await back.click()
    }
  }
  const sequence = page.getByLabel('Arrival CG burn sequence')
  await sequence.selectOption('Incomplete synthetic sequence')
  await action.click()
  await expect(section).toContainText('distinct positive integer positions')
  await capture('invalid-sequence-long-reason')
  await back.click()
  await sequence.selectOption('A first')
  await action.click()
  await expect(section).toContainText('Selected arrival CG burn sequence: A first')
  await expect(section).toContainText('Estimated arrival CG')
  await sequence.evaluate((input: HTMLSelectElement) => {
    input.value = 'B first'; input.dispatchEvent(new Event('change', { bubbles: true })); window.print()
  })
  await expect(preview).toContainText('Preview invalidated')
  await back.click()
  await page.getByRole('textbox', { name: 'Synthetic tank', exact: true }).fill('70')
  await page.getByRole('textbox', { name: 'Synthetic tank', exact: true }).blur()
  await direct.fill('90')
  await expect(action).toBeEnabled()
  await page.getByRole('button', { name: 'Reset Payload', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(action).toBeDisabled()
  await expect(include).toBeChecked()
  await page.reload()
  await select('D-MULTI')
  await expect(include).not.toBeChecked()
  await expect(method).toHaveValue('')
  await expect(sequence).toHaveValue('')
  await context.setOffline(false)
})
