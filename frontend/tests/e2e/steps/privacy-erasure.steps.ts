import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { flushFleetSeed, readStoredProfile, stageFleetSeed } from '../fixtures/fleet-seed'
import { mbScenarioFleet } from '../fixtures/mb-scenario-fleet'

const { Given, When, Then } = createBdd()
type Store = 'localStorage' | 'sessionStorage'
type FixtureWindow = Window & { __restoreErasureStorage?: () => void }
const deniedStores = new WeakMap<Page, Store>()
const KEY = 'aerodash:erasure-fixture'

async function confirmDeletion(page: Page) {
  await page.getByTestId('wipe-request-btn').click()
  await page.getByTestId('wipe-confirm-input').fill('DELETE ALL DATA')
  await page.getByTestId('wipe-confirm-btn').click()
  await expect(page.getByTestId('wipe-dialog')).toBeHidden()
}

Given('Privacy holds saved data at {int} by {int}', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height })
  await page.goto('/privacy')
  await expect(page.getByTestId('wipe-request-btn')).toBeEnabled()
  stageFleetSeed(page, mbScenarioFleet()[0]!)
  await flushFleetSeed(page)
  expect(await readStoredProfile(page, 'D-EBPN')).toBeDefined()
  await page.evaluate((key) => {
    localStorage.setItem(key, 'saved local data')
    sessionStorage.setItem(key, 'saved session data')
  }, KEY)
})

When('the pilot deletes all data while the {word} getter is denied', async ({ page }, store: Store) => {
  deniedStores.set(page, store)
  await page.evaluate((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(window, name)!
    ;(window as FixtureWindow).__restoreErasureStorage = () => Object.defineProperty(window, name, descriptor)
    Object.defineProperty(window, name, {
      configurable: true,
      get() { throw new DOMException('Temporary storage policy denial', 'SecurityError') },
    })
  }, store)
  await confirmDeletion(page)
})

Then('Privacy reports incomplete erasure and still clears reachable stores', async ({ page, $testInfo }) => {
  const notice = page.getByTestId('privacy-error')
  await expect(notice).toHaveAttribute('role', 'alert')
  await expect(notice).toContainText('Erasure incomplete')
  await expect(notice).toContainText('Retry the deletion')
  await expect(page.getByTestId('privacy-wipe-notice')).toHaveCount(0)
  expect(await readStoredProfile(page, 'D-EBPN')).toBeUndefined()
  const other = deniedStores.get(page) === 'localStorage' ? 'sessionStorage' : 'localStorage'
  expect(await page.evaluate(({ store, key }) => window[store].getItem(key), { store: other, key: KEY })).toBeNull()
  await $testInfo.attach('incomplete-erasure', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

When('storage access is restored and the pilot retries deletion', async ({ page }) => {
  const store = deniedStores.get(page)!
  await page.evaluate(() => {
    ;(window as FixtureWindow).__restoreErasureStorage!()
    delete (window as FixtureWindow).__restoreErasureStorage
  })
  expect(await page.evaluate(({ name, key }) => window[name].getItem(key), { name: store, key: KEY }))
    .toBe(store === 'localStorage' ? 'saved local data' : 'saved session data')
  await confirmDeletion(page)
})

Then('Privacy reports successful erasure and the retained data is gone', async ({ page, $testInfo }) => {
  await expect(page.getByTestId('privacy-wipe-notice')).toBeVisible()
  await expect(page.getByTestId('privacy-error')).toHaveCount(0)
  expect(await page.evaluate((key) => [localStorage.getItem(key), sessionStorage.getItem(key)], KEY)).toEqual([null, null])
  await $testInfo.attach('successful-retry', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
