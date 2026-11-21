import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic 750 kg BEM + 100 kg payload + 50 kg fuel. Linear table formula:
// 100 + phaseIndex*100 + mass-800 + PA/100 + temperature (metres).
test('complete current briefing pack with chart, persistent action and native stale guard online and offline', async ({ page, context }, info) => {
  await page.goto('/')
  await page.getByTestId('disclaimer-gate-accept').click()
  const styleOf = (element: HTMLElement) => {
    const style = getComputedStyle(element)
    return Object.fromEntries(['backgroundColor', 'color', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'gap', 'minHeight', 'boxShadow'].map(key => [key, style[key as keyof CSSStyleDeclaration]]))
  }
  const homeCta = page.getByRole('link', { name: 'Start flight preparation', exact: true })
  const ctaStyle = await homeCta.evaluate(styleOf)
  for (const width of new Set([page.viewportSize()!.width, ...(info.project.name.endsWith('390') ? [320] : [])])) {
    await page.setViewportSize({ width, height: 1000 })
    const performance = page.getByRole('link', { name: 'Open Performance', exact: true })
    const icon = performance.locator('.module-card__icon svg')
    await expect(icon).toBeVisible()
    const mbIcon = page.getByRole('link', { name: 'Open Mass & Balance', exact: true }).locator('.module-card__icon svg')
    expect(await icon.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, color: getComputedStyle(e).color }))).toEqual(await mbIcon.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, color: getComputedStyle(e).color })))
    const aligned = await performance.evaluate(e => {
      const icon = e.querySelector('.module-card__icon')!.getBoundingClientRect()
      const card = e.getBoundingClientRect()
      return Math.abs(icon.y + icon.height / 2 - card.y - card.height / 2)
    })
    expect(aligned).toBeLessThan(1)
    await expect(page.locator('.app-sidebar, .app-bottom-nav').getByRole('link', { name: 'Performance', exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true })
    await performance.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/performance$/)
    await page.goto('/')
    await homeCta.click()
    await expect(page).toHaveURL(/\/mass-balance$/)
    const unavailable = page.getByRole('button', { name: 'Briefing Pack', exact: true })
    await expect(unavailable).toBeDisabled()
    await expect(unavailable).not.toHaveAttribute('aria-describedby')
    await expect(unavailable).not.toHaveAttribute('title')
    await expect(page.locator('.briefing-action')).toHaveText('Briefing Pack')
    expect(await unavailable.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(ctaStyle.backgroundColor)
    const box = (await unavailable.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await unavailable.evaluate(e => e.focus())
    await expect(unavailable).not.toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    await expect(page.getByRole('dialog', { name: 'Briefing Pack preview' })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`disabled-${width}.png`) })
    await page.goto('/performance')
    await expect(page.getByRole('heading', { name: /Performance/ }).first()).toBeVisible()
    await page.goto('/')
  }
  await page.setViewportSize({ width: Number(info.project.name.split('-')[1]), height: 1000 })
  await page.goto('/fleet')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  profile.certificationCategories.push({ ...profile.certificationCategories[0]!, category: 'Utility' })
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-performance.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  const fuel = page.getByRole('region', { name: 'Fuel & Endurance', exact: true })
  await expect(action).toBeEnabled()
  await expect.poll(() => action.evaluate(styleOf)).toEqual(ctaStyle)
  const payload = page.getByRole('textbox', { name: 'Synthetic payload', exact: true })
  await payload.fill('')
  await expect(action).toBeDisabled()
  await expect(page.locator('.briefing-action')).toHaveText('Briefing Pack')
  await payload.fill('100')
  await payload.blur()
  await expect(action).toBeEnabled()
  await action.click()
  await expect(preview).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(action).toBeFocused()
  await page.screenshot({ path: info.outputPath('enabled-recovered.png') })
  for (const offline of [false, true]) {
    if (offline) {
      await context.setOffline(true)
      expect((await page.reload())?.fromServiceWorker()).toBe(true)
    }
    await fuel.getByLabel('Planning method').selectOption('direct')
    await fuel.getByLabel('Trip Fuel (kg)', { exact: true }).fill('20')
    await perf.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
    await perf.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
    await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')
    const runway = perf.getByRole('form', { name: 'Manual runway', exact: true })
    await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic field')
    await runway.getByLabel('Runway designator', { exact: true }).fill('18')
    await runway.getByLabel('TORA — takeoff run available', { exact: true }).fill('1000')
    await runway.getByLabel('LDA — landing distance available', { exact: true }).fill('900')
    await runway.getByLabel('Field elevation', { exact: true }).fill('1000')
    await runway.getByLabel('Surface type', { exact: true }).selectOption('paved')
    await runway.getByLabel('Surface condition', { exact: true }).selectOption('dry')
    await runway.getByRole('button', { name: 'Save runway inputs', exact: true }).click()

    for (const fraction of [0, .5, 1]) {
      await page.evaluate(f => window.scrollTo(0, document.documentElement.scrollHeight * f), fraction)
      await expect.poll(() => page.evaluate(() => window.scrollY > 0)).toBe(fraction > 0)
      await expect(action).toBeInViewport()
      const buttonBox = (await action.boundingBox())!
      const navBox = await page.locator('.app-bottom-nav').boundingBox()
      const clearance = navBox ? navBox.y : page.viewportSize()!.height
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(clearance)
      await page.screenshot({ path: info.outputPath(`${offline ? 'offline' : 'online'}-scroll-${fraction}.png`) })
    }
    const lastContent = (await page.getByRole('note', { name: 'Operational disclaimer' }).boundingBox())!
    const actionTop = (await page.locator('.briefing-action').boundingBox())!.y
    expect(lastContent.y + lastContent.height).toBeLessThanOrEqual(actionTop)
    await action.focus()
    await page.keyboard.press('Enter')
    await expect(preview).toContainText('900.0 kg')
    await expect(preview).toContainText('880.0 kg')
    await expect(preview).toContainText('220.0 m')
    await expect(preview).toContainText('400.0 m')
    await expect(preview).toContainText('Synthetic field')
    await expect(preview).toContainText('MTOM:')
    await expect(preview.getByRole('img')).toBeVisible()
    for (const removed of ['Profile and source status', 'Applicable category limits', 'No current M&B notifications.', 'The all-usable-fuel-burned endpoint is not the trip-specific arrival.']) {
      await expect(preview).not.toContainText(removed)
    }
    await expect(preview.getByRole('heading', { name: 'Current M&B notifications' })).toHaveCount(0)
    await preview.getByRole('button', { name: 'Print Briefing Pack', exact: true }).click()
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#app')).toBeHidden()
    await expect(preview.getByRole('img')).toBeVisible()
    const pdfPath = info.outputPath(`${offline ? 'offline' : 'online'}-complete.pdf`)
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
    await info.attach('complete-pack-pdf', { path: pdfPath, contentType: 'application/pdf' })
    await page.screenshot({ path: info.outputPath(`${offline ? 'offline' : 'online'}-print.png`), fullPage: true })
    await page.emulateMedia({ media: 'screen' })
    // Native printing in the same event turn as a conditions mutation.
    const guarded = await perf.getByLabel('Temperature (°C)', { exact: true }).evaluate((input: HTMLInputElement) => {
      input.value = '11'; input.dispatchEvent(new Event('input', { bubbles: true })); window.print()
      return document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')
    })
    expect(guarded).toBe('true')
    await expect(preview).not.toContainText('220.0 m')
    await page.keyboard.press('Escape')
    await action.click()
    await expect(preview).toContainText('221.0 m')
    await expect(preview).not.toContainText('220.0 m')
    await page.keyboard.press('Escape')
  }
})

test('M&B warning meaning survives preview and PDF online and after offline reload', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 750
  profile.certificationCategories[0]!.mtom = 850
  profile.certificationCategories[0]!.envelope[2]!.armOrMoment = 1.05
  profile.certificationCategories[0]!.envelope[3]!.armOrMoment = 1.05
  profile.loadPoints = [
    { name: 'Synthetic payload', kind: 'occupant', occupancy: 'required', arm: 2, armLookup: [], operationalLimit: 50, defaultQuantity: 100, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic empty seat', kind: 'occupant', occupancy: 'required', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 0, unit: 'kg', allowableCategories: null, fuelTank: null },
    { name: 'Synthetic tank', kind: 'fuel', arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 50, unit: 'kg', allowableCategories: null, fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
  ]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic-warnings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const verify = page.getByRole('dialog')
  await verify.getByLabel('Verifier initials').fill('QA')
  await verify.getByLabel('POH revision').fill('Synthetic wiring only')
  await verify.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(verify).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  const action = page.getByRole('button', { name: 'Briefing Pack', exact: true })
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  for (const offline of [false, true]) {
    if (offline) { await context.setOffline(true); expect((await page.reload())?.fromServiceWorker()).toBe(true) }
    await page.getByRole('textbox', { name: 'Synthetic empty seat', exact: true }).fill('0')
    await page.getByRole('textbox', { name: 'Synthetic empty seat', exact: true }).blur()
    await expect(action).toBeEnabled()
    await action.click()
    for (const message of ['MTOM Exceeded', 'CG Out of Envelope', 'Station 0 limit exceeded', 'Implausible mass on required station', '900.0 kg']) await expect(preview).toContainText(message)
    await expect(preview.locator('.briefing-critical').filter({ hasText: 'MTOM Exceeded' })).toContainText('900.0 kg')
    await expect(preview.locator('.briefing-critical').filter({ hasText: 'CG Out of Envelope' }).first()).toContainText('1.111 m')
    const results = preview.getByRole('table').filter({ hasText: 'Applicable limit' })
    await expect(results.getByRole('row').filter({ hasText: 'Takeoff' })).toContainText('CG Out of Envelope')
    for (const label of ['Zero fuel', 'All usable fuel burned']) {
      await expect(results.getByRole('row').filter({ hasText: label })).not.toContainText('CG Out of Envelope')
    }
    const ids = ['CRIT-MB-001', 'CRIT-MB-002', 'WARN-MB-005', 'WARN-UQ-001']
    const accessible = await preview.ariaSnapshot()
    for (const id of ids) { await expect(preview).not.toContainText(id); expect(accessible).not.toContain(id) }
    for (const message of ['MTOM Exceeded', 'CG Out of Envelope', 'Station 0 limit exceeded', 'Implausible mass on required station']) expect(accessible).toContain(message)
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 894 })
      expect(await preview.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`warning-${offline}-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    const download = page.waitForEvent('download')
    await preview.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const file = await download
    const downloaded = info.outputPath(`download-${offline}.pdf`)
    await file.saveAs(downloaded)
    const downloadedText = execFileSync('pdftotext', ['-layout', downloaded, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
    for (const id of ids) expect(downloadedText).not.toContain(id)
    for (const message of ['CRITICAL', 'MTOM Exceeded', 'CG Out of Envelope', 'Station 0 limit exceeded', 'Implausible mass on required station', '900.0 kg', 'NO CERTIFIED AVIATION DEVICE', 'The official handbook always takes precedence.', 'Pilot in Command Responsibility']) expect(downloadedText).toContain(message)
    expect(execFileSync('pdfimages', ['-list', downloaded], { encoding: 'utf8' })).toContain('jpeg')
    await info.attach(`download-${offline}`, { path: downloaded, contentType: 'application/pdf' })
    await page.emulateMedia({ media: 'print' })
    const pdf = info.outputPath(`warning-${offline}.pdf`)
    await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true })
    const pdfText = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
    for (const id of ids) expect(pdfText).not.toContain(id)
    for (const message of ['CRITICAL', 'MTOM Exceeded', 'CG Out of Envelope', 'Station 0 limit exceeded', 'Implausible mass on required station', '900.0 kg']) expect(pdfText).toContain(message)
    await info.attach(`warning-${offline}`, { path: pdf, contentType: 'application/pdf' })
    await page.emulateMedia({ media: 'screen' })
    await page.keyboard.press('Escape')
  }
})
