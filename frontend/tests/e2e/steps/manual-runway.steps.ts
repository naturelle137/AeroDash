import { expect, type Page } from '@playwright/test'
import process from 'node:process'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()
const STORAGE_KEY = 'aerodash.performance.manual-runway.v1'
const summary = (page: Page) => page.getByRole('region', { name: 'Saved manual runway', exact: true })
const panel = (page: Page) => page.locator('form[aria-labelledby="manual-runway-heading"]')

type SameDocument = Window & { __sameDocument?: string }
type Entry = {
  aerodrome: string; designator: string; tora: string; toraUnit: string; lda: string; ldaUnit: string
  elevation: string; elevationUnit: string; surfaceType: string; condition?: string
}

async function enter(page: Page, entry: Entry) {
  const form = panel(page)
  await form.getByLabel('Aerodrome', { exact: true }).fill(entry.aerodrome)
  await form.getByLabel('Runway designator', { exact: true }).fill(entry.designator)
  await form.getByLabel('TORA — takeoff run available', { exact: true }).fill(entry.tora)
  await form.getByLabel('TORA unit', { exact: true }).selectOption(entry.toraUnit)
  await form.getByLabel('LDA — landing distance available', { exact: true }).fill(entry.lda)
  await form.getByLabel('LDA unit', { exact: true }).selectOption(entry.ldaUnit)
  await form.getByLabel('Field elevation', { exact: true }).fill(entry.elevation)
  await form.getByLabel('Field elevation unit', { exact: true }).selectOption(entry.elevationUnit)
  await form.getByLabel('Surface type', { exact: true }).selectOption({ label: entry.surfaceType })
  if (entry.condition) await form.getByLabel('Surface condition', { exact: true }).selectOption({ label: entry.condition })
}
async function save(page: Page) {
  await panel(page).getByRole('button', { name: 'Save runway inputs', exact: true }).click()
}
async function openPerformance(page: Page) {
  // Client-side navigation keeps working without network once the shell is loaded.
  await page.locator('nav a[href="/performance"]:visible').first().click()
  await expect(page.getByRole('heading', { name: 'Manual runway', exact: true })).toBeVisible()
}

Given('the manual runway viewport is {int} by {int}', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height })
})

Given('the pilot opens Performance and then loses connectivity', async ({ page, $test }) => {
  await page.goto('/')
  const installed = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    return registration !== null
  })
  // Only the production preview build registers the offline service worker.
  $test.skip(!installed && !process.env.CI, 'Offline reload requires the production preview build (CI=1).')
  expect(installed).toBe(true)
  // The first load installs the worker; the next navigation is controlled by it.
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await openPerformance(page)
  await page.context().setOffline(true)
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
})

Given('the pilot opens Performance', async ({ page }) => {
  await page.goto('/')
  await openPerformance(page)
})

Given('the browser holds {word} manual runway data', async ({ page }, kind: string) => {
  const raw = kind === 'damaged'
    ? '{"schemaVersion":1,"runway":'
    : JSON.stringify({ schemaVersion: 2, savedAt: '2026-11-12T10:00:00.000Z', runway: { aerodrome: 'TEST' } })
  await page.goto('/')
  await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [STORAGE_KEY, raw])
})

When('the pilot saves runway {string} {string} with TORA {string} {string}, LDA {string} {string}, elevation {string} {string} and surface {string} {string}',
  async ({ page }, aerodrome: string, designator: string, tora: string, toraUnit: string, lda: string, ldaUnit: string,
    elevation: string, elevationUnit: string, surfaceType: string, condition: string) => {
    await enter(page, { aerodrome, designator, tora, toraUnit, lda, ldaUnit, elevation, elevationUnit, surfaceType, condition })
    await save(page)
    await expect(panel(page).getByRole('status').filter({ hasText: 'saved on this device' })).toBeVisible()
  })

When('the pilot enters runway {string} {string} with TORA {string} {string}, LDA {string} {string}, elevation {string} {string} and surface {string} {string}',
  async ({ page }, aerodrome: string, designator: string, tora: string, toraUnit: string, lda: string, ldaUnit: string,
    elevation: string, elevationUnit: string, surfaceType: string, condition: string) => {
    await enter(page, { aerodrome, designator, tora, toraUnit, lda, ldaUnit, elevation, elevationUnit, surfaceType, condition })
  })

When('the pilot enters runway {string} {string} with TORA {string} {string}, LDA {string} {string}, elevation {string} {string} and surface type {string} only',
  async ({ page }, aerodrome: string, designator: string, tora: string, toraUnit: string, lda: string, ldaUnit: string,
    elevation: string, elevationUnit: string, surfaceType: string) => {
    await enter(page, { aerodrome, designator, tora, toraUnit, lda, ldaUnit, elevation, elevationUnit, surfaceType })
  })

When('the pilot saves the runway inputs', async ({ page }) => { await save(page) })

When('the pilot changes the LDA to {string} {string}', async ({ page }, value: string, unit: string) => {
  await panel(page).getByLabel('LDA — landing distance available', { exact: true }).fill(value)
  await panel(page).getByLabel('LDA unit', { exact: true }).selectOption(unit)
})

When('the pilot reloads the app', async ({ page }) => {
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Manual runway', exact: true })).toBeVisible()
})

When('the pilot deletes all local data from Privacy', async ({ page }) => {
  // In-app navigation only: the same tab, document and Pinia instance must survive the wipe.
  await page.evaluate(() => { (window as SameDocument).__sameDocument = 'before-wipe' })
  await page.locator('nav a[href="/privacy"]:visible').first().click()
  await page.getByTestId('wipe-request-btn').click()
  await page.getByTestId('wipe-confirm-input').fill('DELETE ALL DATA')
  await page.getByTestId('wipe-confirm-btn').click()
  await expect(page.getByTestId('privacy-wipe-notice')).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
})

When('the pilot returns to Performance without reloading', async ({ page }) => {
  await openPerformance(page)
  // A reload would have dropped the marker set before the wipe.
  expect(await page.evaluate(() => (window as SameDocument).__sameDocument)).toBe('before-wipe')
})

When('the pilot clears the runway inputs', async ({ page }) => {
  await panel(page).getByRole('button', { name: 'Clear runway inputs', exact: true }).click()
  await expect(panel(page).getByRole('status').filter({ hasText: 'cleared from this device' })).toBeVisible()
})

Then('the saved runway shows TORA {string}, LDA {string} and elevation {string}', async ({ page }, tora: string, lda: string, elevation: string) => {
  const values = summary(page).locator('dd')
  await expect(values.nth(0)).toHaveText(tora)
  await expect(values.nth(1)).toHaveText(lda)
  await expect(values.nth(2)).toHaveText(elevation)
})

Then('the runway is labelled user-entered and the runway assessment is unavailable', async ({ page }) => {
  await expect(summary(page)).toContainText('User-entered, not airport-validated')
  await expect(panel(page)).toContainText('Runway assessment unavailable.')
  await expect(page.getByText(/\bGo\b result available|runway sufficient/i)).toHaveCount(0)
})

Then('the saved runway is no longer shown as current', async ({ page }) => {
  await expect(summary(page)).toHaveCount(0)
  await expect(panel(page)).toContainText('Unsaved changes')
})

Then('the runway form still holds LDA {string} in {string} and TORA {string} in {string}', async ({ page }, lda: string, ldaUnit: string, tora: string, toraUnit: string) => {
  const form = panel(page)
  await expect(form.getByLabel('LDA — landing distance available', { exact: true })).toHaveValue(lda)
  await expect(form.getByLabel('LDA unit', { exact: true })).toHaveValue(ldaUnit)
  await expect(form.getByLabel('TORA — takeoff run available', { exact: true })).toHaveValue(tora)
  await expect(form.getByLabel('TORA unit', { exact: true })).toHaveValue(toraUnit)
})

Then('the field elevation is not used as pressure altitude', async ({ page }) => {
  await expect(page.getByText('No method selected.')).toBeVisible()
  await page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await expect(page.getByLabel('Pressure altitude (ft)', { exact: true })).toHaveValue('')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(page.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('')
})

Then('the manual runway evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const width = page.viewportSize()!.width
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width)
  await summary(page).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`manual-runway-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Manual runway ${name}`, { path, contentType: 'image/png' })
})

Then('no saved runway is shown', async ({ page }) => {
  await expect(summary(page)).toHaveCount(0)
  await expect(panel(page)).toContainText('Runway assessment unavailable.')
})

Then('the runway form is empty', async ({ page }) => {
  const form = panel(page)
  for (const label of ['Aerodrome', 'Runway designator', 'TORA — takeoff run available', 'LDA — landing distance available', 'Field elevation']) {
    await expect(form.getByLabel(label, { exact: true })).toHaveValue('')
  }
  await expect(form.getByText('Unsaved changes')).toHaveCount(0)
})

Then('saving is refused because {string}', async ({ page, $testInfo }, message: string) => {
  await expect(panel(page).getByRole('alert').filter({ hasText: 'Runway inputs not saved' })).toBeVisible()
  await expect(panel(page).locator('.field-error').filter({ hasText: message })).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
  const path = $testInfo.outputPath(`manual-runway-refused-${page.viewportSize()!.width}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach('Refused runway save', { path, contentType: 'image/png' })
})

Then('the pilot is told {string}', async ({ page, $testInfo }, message: string) => {
  await expect(panel(page).getByRole('alert')).toContainText(message)
  const path = $testInfo.outputPath(`manual-runway-storage-${message.split(' ')[0]}.png`)
  await panel(page).screenshot({ path })
  await $testInfo.attach('Visible storage problem', { path, contentType: 'image/png' })
})

Then('no storage problem is reported', async ({ page }) => {
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
})
