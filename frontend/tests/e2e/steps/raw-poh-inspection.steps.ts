import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { Given, When, Then } = createBdd()
const result = (page: Page) => page.getByRole('region', { name: 'Raw POH table distances', exact: true })
async function importFile(page: Page, profile: unknown) {
  await page.goto('/fleet')
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'Test-wiring-only.aerodash.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
  })
}
async function selectOnlyProfile(page: Page) {
  const select = page.getByLabel('Aircraft profile', { exact: true })
  await expect(select.locator('option')).toHaveCount(2)
  const id = await select.locator('option').nth(1).getAttribute('value')
  await select.selectOption(id!)
}
async function validInputs(page: Page) {
  await page.getByLabel('Mass (kg)', { exact: true }).fill('900')
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
  await page.getByLabel('Temperature (°C)', { exact: true }).fill('10')
}
async function compute(page: Page) {
  await page.getByRole('button', { name: 'Compute raw distances', exact: true }).click()
}
async function verify(page: Page) {
  await page.goto('/fleet')
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Test wiring only - no real POH')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
}
async function assertDistances(page: Page) {
  await expect(result(page)).toBeVisible()
  const values = result(page).locator('dd')
  await expect(values).toHaveText(['220.0 m', '320.0 m', '420.0 m', '520.0 m'])
}

Given('the raw POH workflow viewport is {int} by {int}', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height })
})
When('I import the synthetic Test POH exchange file', async ({ page }) => {
  await importFile(page, testPohAircraft())
})
Then('I can inspect every imported table while the profile remains Draft', async ({ page }) => {
  const row = page.locator('.profile-item').filter({ hasText: 'D-TEST' })
  await expect(row).toContainText('Draft')
  await row.getByText('Review imported performance tables', { exact: true }).click()
  for (const phase of ['TakeoffRoll', 'TakeoffDistance50ft', 'LandingRoll', 'LandingDistance50ft']) {
    await row.getByText(`${phase} — 8 points`, { exact: true }).click()
  }
  await expect(row.locator('tbody tr')).toHaveCount(32)
  await expect(row.locator('tbody tr').first()).toContainText('800')
})
Then('raw POH computation is blocked for the Draft', async ({ page }) => {
  await page.getByRole('link', { name: 'Open Performance', exact: true }).click()
  await selectOnlyProfile(page)
  await validInputs(page)
  await compute(page)
  await expect(page.getByRole('alert')).toContainText('Draft profile')
  await expect(result(page)).toHaveCount(0)
})
When('I explicitly verify the Test POH profile in Fleet', async ({ page }) => { await verify(page) })
Then('the Performance navigation opens a usable table lookup', async ({ page }) => {
  await page.locator('nav a[href="/performance"]:visible').first().click()
  await expect(page.getByRole('heading', { name: 'Performance', exact: true })).toBeVisible()
  await selectOnlyProfile(page)
  await expect(page.locator('.source-info')).toContainText('Test wiring only - no real POH')
  await expect(page.locator('.source-info')).toContainText('Snapshot ID:')
  await expect(page.locator('.bounds')).toContainText('800 to 1000 kg')
})
Then('four raw Test distances are computed inside the envelope', async ({ page }) => {
  await validInputs(page)
  await compute(page)
  await assertDistances(page)
})
Then('editing each input immediately clears the raw distances', async ({ page }) => {
  for (const label of ['Mass (kg)', 'Pressure altitude (ft)', 'Temperature (°C)']) {
    await page.getByLabel(label, { exact: true }).fill('901')
    await expect(result(page)).toHaveCount(0)
    await validInputs(page)
    await compute(page)
    await assertDistances(page)
  }
  await page.getByLabel('Aircraft profile', { exact: true }).selectOption('')
  await expect(result(page)).toHaveCount(0)
  await selectOnlyProfile(page)
})
Then('blank, nonfinite, nonpositive and out-of-envelope lookup inputs stay blocked', async ({ page }) => {
  for (const [label, value] of [
    ['Mass (kg)', ''], ['Pressure altitude (ft)', ''], ['Temperature (°C)', ''],
    ['Mass (kg)', 'NaN'], ['Pressure altitude (ft)', 'Infinity'], ['Temperature (°C)', 'abc'],
    ['Mass (kg)', '0'], ['Mass (kg)', '-1'],
    ['Mass (kg)', '799'], ['Mass (kg)', '1001'],
    ['Pressure altitude (ft)', '-1'], ['Pressure altitude (ft)', '2001'],
    ['Temperature (°C)', '-1'], ['Temperature (°C)', '21'],
  ]) {
    await validInputs(page)
    await page.getByLabel(label!, { exact: true }).fill(value!)
    await compute(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(result(page)).toHaveCount(0)
  }
})
Then('the reviewed tables survive a browser reload and exchange download', async ({ page }) => {
  await page.reload()
  await expect(result(page)).toHaveCount(0)
  await selectOnlyProfile(page)
  await validInputs(page)
  await compute(page)
  await assertDistances(page)
  await page.getByRole('link', { name: 'Open Fleet to import, review or verify a profile' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download D-TEST exchange file', exact: true }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks).toString())
  expect(exported.profile.performanceProfiles).toEqual(testPohAircraft().performanceProfiles)
  expect(exported.profile.status).toBe('verified')
  await page.getByRole('link', { name: 'Open Performance', exact: true }).click()
  await selectOnlyProfile(page)
  await validInputs(page)
  await compute(page)
  await assertDistances(page)
})
Then('the raw POH browser evidence is captured', async ({ page, $testInfo }) => {
  const width = page.viewportSize()!.width
  await page.getByRole('heading', { name: 'Performance', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width)
  await $testInfo.attach(`raw-poh-${width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
When('I import a Test POH profile with {string}', async ({ page }, problem: string) => {
  const p = testPohAircraft()
  if (problem === 'missing phase') p.performanceProfiles!.pop()
  if (problem === 'duplicate phase') p.performanceProfiles!.push(p.performanceProfiles![0]!)
  if (problem === 'zero distance') p.performanceProfiles![0]!.dataPoints[0]!.distance = 0
  if (problem === 'incomplete grid') p.performanceProfiles![0]!.dataPoints.pop()
  if (problem === 'duplicate point') p.performanceProfiles![0]!.dataPoints[0] = p.performanceProfiles![0]!.dataPoints[1]!
  await importFile(page, p)
})
Then('the table problem {string} blocks raw distances after explicit verification', async ({ page }, message: string) => {
  await verify(page)
  await page.getByRole('link', { name: 'Open Performance', exact: true }).click()
  await selectOnlyProfile(page)
  await validInputs(page)
  await compute(page)
  await expect(page.getByRole('alert').first()).toContainText(message)
  await expect(result(page)).toHaveCount(0)
})
When('I import invalid Test POH JSON with {string}', async ({ page }, problem: string) => {
  const p = testPohAircraft()
  let raw: unknown = p
  if (problem === 'invalid schema') raw = { registration: 'D-TEST' }
  if (problem === 'negative distance') p.performanceProfiles![0]!.dataPoints[0]!.distance = -1
  if (problem === 'nonfinite point') p.performanceProfiles![0]!.dataPoints[0]!.mass = Infinity
  if (problem === 'unsupported phase') raw = { ...p, performanceProfiles: [{ flightPhase: 'Cruise', dataPoints: [] }] }
  await importFile(page, raw)
})
Then('Fleet rejects the exchange and has no Test profile', async ({ page }) => {
  await expect(page.locator('.field-error')).toContainText('Profile validation failed')
  await expect(page.locator('.profile-item')).toHaveCount(0)
})
