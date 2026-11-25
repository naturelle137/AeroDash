import { expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { Given, When, Then } = createBdd()
const takeoff = (page: Page) => page.getByRole('region', { name: 'Takeoff corrected distances', exact: true })

Given('the production app is cached for offline performance', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
})

When('the pilot clears the runway surface condition', async ({ page }) => {
  await page.getByLabel('Surface condition', { exact: true }).selectOption('')
})

When('I import and verify a synthetic POH profile for registration {string} declaring type {string} and maximum mass {int} kg',
  async ({ page }, registration: string, icaoTypeDesignator: string, mtom: number) => {
    const base = testPohAircraft()
    const profile = { ...base, registration, icaoTypeDesignator, certificationCategories: [{ ...base.certificationCategories[0]!, mtom }], status: 'draft' }
    await page.goto('/fleet')
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'Test-wiring-only.aerodash.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await page.getByRole('button', { name: `Verify ${registration}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Verifier initials').fill('TS')
    await dialog.getByLabel('POH revision').fill('Test wiring only - no real POH')
    await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(dialog).toBeHidden()
  })

Then('corrected briefing distances have no unverified marker', async ({ page }) => {
  const section = page.getByRole('dialog', { name: 'Briefing Pack preview' }).getByRole('heading', { name: 'Takeoff corrected distances', exact: true }).locator('..')
  const rows = section.locator('tbody tr')
  expect(await rows.count()).toBeGreaterThan(0)
  for (const row of await rows.all()) {
    await expect(row.locator('td')).toContainText('(raw ' )
    await expect(row.locator('td')).not.toContainText('[UNVERIFIED]')
  }
  await section.scrollIntoViewIfNeeded()
})

When('the pilot enters takeoff headwind {string} kt and slope {string} %', async ({ page }, headwind: string, slope: string) => {
  await page.getByLabel('Headwind component (kt, negative = tailwind)').first().fill(headwind)
  await page.getByLabel('Runway slope (%, positive = uphill)').first().fill(slope)
})

Then('the corrected takeoff distances are {string}', async ({ page }, expected: string) => {
  const region = takeoff(page)
  await expect(region).toBeVisible()
  if (expected.startsWith('unavailable: ')) {
    await expect(region).toContainText(`Not corrected: ${expected.slice('unavailable: '.length)}`)
    return
  }
  const [, value] = /final (\d+ m)/.exec(expected)!
  await expect(region).toContainText('Tecnam P2008 JC Aircraft Flight Manual')
  await expect(region.locator('dd').first()).toContainText(value!)
})

Then('the corrected takeoff distances are marked as an estimate from the LBA advisory', async ({ page }) => {
  const region = takeoff(page)
  await expect(region).toContainText('LBA Flugsicherheitsmitteilung FSM 3/75')
  await expect(region).toContainText('ESTIMATED (FSM 3/75)')
  await expect(region).toContainText('not validated by it')
  await expect(region).toContainText('supplies no wind correction')
})

Then('the corrected distance evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await takeoff(page).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`corrected-distances-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Corrected distances ${name}`, { path, contentType: 'image/png' })
})

Then('the takeoff runway comparison is {string}', async ({ page }, verdict: string) => {
  await expect(takeoff(page).locator('.comparison')).toContainText(verdict)
})

When('the pilot selects the takeoff safety factor {string}', async ({ page }, preset: string) => {
  await page.getByLabel('Safety factor').first().selectOption({ label: preset })
})

Then('the takeoff safety factor warning is {string}', async ({ page }, state: string) => {
  const warning = takeoff(page).locator('[data-warning="WARN-PF-002"]')
  if (state === 'shown') await expect(warning).toContainText('WARN-PF-002')
  else await expect(warning).toHaveCount(0)
})

When('the pilot enters landing headwind {string} kt and slope {string} %', async ({ page }, headwind: string, slope: string) => {
  await page.getByLabel('Headwind component (kt, negative = tailwind)').last().fill(headwind)
  await page.getByLabel('Runway slope (%, positive = uphill)').last().fill(slope)
})

Then('the partial takeoff and unavailable landing disclose missing corrections', async ({ page }) => {
  const result = takeoff(page)
  await expect(result).toContainText('ESTIMATED (FSM 3/75)')
  await expect(result).toContainText('no applicable correction applied for wind')
  await expect(result).toContainText('partially corrected distances')
  await expect(result.locator('.comparison')).toContainText('Do not use this comparison for runway assessment')
  const landing = page.getByRole('region', { name: 'Landing corrected distances', exact: true })
  await expect(landing).toContainText('Wind component -2 kt was not applied')
  await expect(landing).toContainText('No applicable wind, surface or slope correction source')
  await expect(landing).toContainText('no applicable correction applied for wind, surface, slope')
  const value = landing.locator('dd').first()
  const initial = await value.innerText()
  const inputs = page.getByRole('group', { name: 'Landing wind and slope' })
  await inputs.getByLabel('Safety factor').selectOption('custom')
  await inputs.getByLabel('Custom safety factor (1.00–3.00)').fill('2')
  await expect(value).not.toHaveText(initial)
})

Then('the landing correction shows its source and final ground roll {string}', async ({ page }, value: string) => {
  const region = page.getByRole('region', { name: 'Landing corrected distances', exact: true })
  await expect(region).toContainText('Tecnam P2008 JC Aircraft Flight Manual')
  await expect(region.locator('dd').first()).toContainText(value)
  await expect(takeoff(page)).toContainText('Not corrected: Enter the headwind component')
})

Then('the landing correction evidence is captured as {string}', async ({ page, $testInfo }, width: string) => {
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.getByRole('region', { name: 'Landing corrected distances', exact: true }).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`landing-correction-${width}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Landing correction ${width}`, { path, contentType: 'image/png' })
})

When('the pilot selects the imported aircraft {string} in Flight Prep', async ({ page }, registration: string) => {
  await page.locator('nav a[href="/mass-balance"]:visible').first().click()
  const select = page.getByLabel('Select aircraft')
  await select.selectOption({ label: (await select.locator('option', { hasText: registration }).textContent())!.trim() })
})

When('the pilot sets temperature {string} °C in Flight Prep', async ({ page }, temperature: string) => {
  await page.getByLabel('Temperature (°C)', { exact: true }).fill(temperature)
})

Then('Flight Prep identifies the raw distance scope and captures evidence', async ({ page, $testInfo }) => {
  const results = page.getByRole('region', { name: 'Base performance distances', exact: true })
  await expect(results.getByRole('group', { name: 'Takeoff raw distances' }).locator('dd').first()).toBeVisible()
  await expect(results).toContainText('Base distances are uncorrected table values without operational factors or runway assessment.')
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await results.scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`raw-scope-${page.viewportSize()!.width}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach('Flight Prep raw distance scope', { path, contentType: 'image/png' })
})

Then("changing each phase's conditions updates its final distance", async ({ page }) => {
  for (const phase of ['Takeoff', 'Landing']) {
    const inputs = page.getByRole('group', { name: `${phase} wind and slope` })
    const result = page.getByRole('region', { name: `${phase} corrected distances`, exact: true })
    const value = result.locator('dd').first()
    await inputs.getByLabel('Headwind component (kt, negative = tailwind)').fill('0')
    await inputs.getByLabel('Runway slope (%, positive = uphill)').fill('0')
    const initial = await value.innerText()
    await inputs.getByLabel('Headwind component (kt, negative = tailwind)').fill('-2')
    await expect(value).not.toHaveText(initial)
    const windy = await value.innerText()
    await inputs.getByLabel('Runway slope (%, positive = uphill)').fill(phase === 'Takeoff' ? '1' : '-1')
    await expect(value).not.toHaveText(windy)
    const sloped = await value.innerText()
    await inputs.getByLabel('Safety factor').selectOption('custom')
    await inputs.getByLabel('Custom safety factor (1.00–3.00)').fill('2')
    await expect(value).not.toHaveText(sloped)
    const base = page.getByRole('group', { name: `${phase} raw distances` })
    await expect(base.getByRole('heading')).toContainText('base distances (uncorrected)')
    expect(await result.evaluate((el, other) => !!(el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING), await base.elementHandle())).toBe(true)
  }
})

Then('pilot-entered wind multipliers change both distances and clear with changed conditions', async ({ page }) => {
  for (const phase of ['Takeoff', 'Landing']) {
    const inputs = page.getByRole('group', { name: `${phase} wind and slope` })
    const result = page.getByRole('region', { name: `${phase} corrected distances`, exact: true })
    const first = result.locator('dd').first()
    const before = await first.innerText()
    await inputs.getByLabel('Manual POH wind multiplier (optional)').fill('1.2')
    await expect(result).toContainText('Enter a positive finite manual wind multiplier and its source')
    await inputs.getByLabel('Wind factor source and section').fill('Synthetic manual section 1')
    await expect(first).not.toHaveText(before)
    await expect(result).toContainText('Synthetic manual section 1')
    await expect(result).toContainText('partially corrected distances')
    await expect(result).toContainText('Do not use this comparison for runway assessment')
    await inputs.getByLabel('Headwind component (kt, negative = tailwind)').fill('-3')
    await expect(inputs.getByLabel('Manual POH wind multiplier (optional)')).toHaveValue('')
    await inputs.getByLabel('Headwind component (kt, negative = tailwind)').fill('-2')
    await inputs.getByLabel('Manual POH wind multiplier (optional)').fill('1.2')
    await inputs.getByLabel('Wind factor source and section').fill('Synthetic manual section 1')
  }
})

Then('pilot-entered surface multipliers work for both operations', async ({ page }) => {
  for (const phase of ['Takeoff', 'Landing']) {
    const inputs = page.getByRole('group', { name: `${phase} wind and slope` })
    const result = page.getByRole('region', { name: `${phase} corrected distances`, exact: true })
    const first = result.locator('dd').first()
    const before = await first.innerText()
    await inputs.getByLabel('Manual ground-roll surface multiplier (optional)').fill('1.2')
    await expect(result).toContainText('Enter a positive finite manual surface multiplier')
    await inputs.getByLabel('Surface factor source and section').fill('Synthetic manual section 2')
    await expect(first).not.toHaveText(before)
    await expect(result).toContainText('Synthetic manual section 2')
    await expect(result).toContainText('Do not use this comparison for runway assessment')
    await inputs.getByLabel('Runway slope (%, positive = uphill)').fill('1')
    await expect(inputs.getByLabel('Manual ground-roll surface multiplier (optional)')).toHaveValue('')
    await inputs.getByLabel('Manual ground-roll surface multiplier (optional)').fill('1.2')
    await inputs.getByLabel('Surface factor source and section').fill('Synthetic manual section 2')
  }
})

When('the pilot enters surface multipliers for the briefing', async ({ page }) => {
  for (const phase of ['Takeoff', 'Landing']) {
    const inputs = page.getByRole('group', { name: `${phase} wind and slope` })
    await inputs.getByLabel('Manual ground-roll surface multiplier (optional)').fill('1.2')
    await inputs.getByLabel('Surface factor source and section').fill('Synthetic manual section 2')
  }
})

Then('the briefing discloses the pilot-entered surface source', async ({ page }) => {
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  await expect(preview).toContainText('Synthetic manual section 2')
  await expect(preview).toContainText('UNVERIFIED PILOT-ENTERED SURFACE FACTOR')
  await expect(preview).toContainText('Source, applicability and correction ordering are unverified')
})

Then('the printed and PDF briefing disclose the pilot-entered surface source', async ({ page, $testInfo }) => {
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('dialog', { name: 'Briefing Pack preview' })).toContainText('Synthetic manual section 2')
  await page.emulateMedia({ media: 'screen' })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const gate = page.getByRole('button', { name: 'Acknowledge unverified data and download PDF' })
  if (await gate.isVisible()) await gate.click()
  const path = $testInfo.outputPath('surface-briefing.pdf')
  await (await download).saveAs(path)
  const pdf = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
  expect(pdf).toContain('Synthetic manual section 2')
  expect(pdf).toContain('Source, applicability and correction ordering are unverified')
})

Then('a pilot-entered landing slope multiplier changes ground roll and clears with slope', async ({ page }) => {
  const inputs = page.getByRole('group', { name: 'Landing wind and slope' })
  const result = page.getByRole('region', { name: 'Landing corrected distances', exact: true })
  const before = await result.locator('dd').first().innerText()
  await inputs.getByLabel('Manual POH landing slope ground-roll multiplier (optional)').fill('1.2')
  await expect(result).toContainText('Enter a positive finite manual landing slope multiplier')
  await inputs.getByLabel('Slope factor source and section').fill('Synthetic manual section 2')
  await expect(result.locator('dd').first()).not.toHaveText(before)
  await expect(result).toContainText('airborne segment is unchanged')
  await expect(result).toContainText('Do not use this comparison for runway assessment')
  await inputs.getByLabel('Runway slope (%, positive = uphill)').fill('-2')
  await expect(inputs.getByLabel('Manual POH landing slope ground-roll multiplier (optional)')).toHaveValue('')
  await inputs.getByLabel('Manual POH landing slope ground-roll multiplier (optional)').fill('1.2')
  await inputs.getByLabel('Slope factor source and section').fill('Synthetic manual section 2')
})

Then('pilot-entered additive wind corrections work for both operations', async ({ page }) => {
  for (const phase of ['Takeoff', 'Landing']) {
    const inputs = page.getByRole('group', { name: `${phase} wind and slope` })
    const result = page.getByRole('region', { name: `${phase} corrected distances`, exact: true })
    await inputs.getByLabel('Manual POH wind multiplier (optional)').fill('')
    await inputs.getByLabel('Manual additive wind correction to both distances (m, optional)').fill('25')
    await inputs.getByLabel('Wind factor source and section').fill('Synthetic manual section 1')
    await expect(result).toContainText('UNVERIFIED PILOT-ENTERED WIND ADDEND')
    await expect(result).toContainText('Synthetic manual section 1')
    await expect(result).toContainText('Do not use this comparison for runway assessment')
    await inputs.getByLabel('Headwind component (kt, negative = tailwind)').fill('-4')
    await expect(inputs.getByLabel('Manual additive wind correction to both distances (m, optional)')).toHaveValue('')
    await inputs.getByLabel('Manual additive wind correction to both distances (m, optional)').fill('25')
    await inputs.getByLabel('Wind factor source and section').fill('Synthetic additive wind section')
  }
})
