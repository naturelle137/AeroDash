/**
 * Step definitions for fleet-delete-after-browser-back.feature
 *
 * Issue #232 regression. The delete control on the Fleet list page must keep
 * firing its confirmation dialog after the pilot returns from the editor via
 * the browser back button or after the page is restored from the browser's
 * bfcache (iOS Safari swipe-back gesture). E2E trace tags live in the
 * `.feature` file only (STC §B.3 / §3.4).
 */

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

// ─── Seed: write a Draft profile into IndexedDB after the app has opened it ──
//
// Driving the full 5-step wizard for every scenario would shave minutes off
// the regression suite, so we write the profile directly into IndexedDB. The
// schema mirrors the canonical "Tecnam P2008 JC" fixture and validates
// against AircraftProfileSchema.
//
// We seed AFTER the first navigation so the app has already opened and
// migrated the database at whatever version `fleet.repository.ts` currently
// uses. Opening here with no `version` argument piggybacks on that existing
// schema — there is no hardcoded `DB_VERSION` to keep in lockstep with the
// production code, so a future schema bump cannot silently break this test
// with an IndexedDB `VersionError`.

const FLEET_DB_NAME = 'aerodash-fleet'
const FLEET_STORE_NAME = 'aircraft_profiles'

interface SeededProfile {
  id: string
  ownerId: string
  registration: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
  sourceUnit: string
  referenceDatumDescription: string
  referenceDatumLocation: string
  shareCode: string | null
  status: string
  schemaVersion: number
  powertrain: string
  passengerProfiles: unknown[]
  weighingReports: unknown[]
  loadPoints: unknown[]
  certificationCategories: unknown[]
}

const SEED_PROFILE: SeededProfile = {
  id: '00000000-0000-4000-a000-000000000232',
  ownerId: '00000000-0000-4000-a000-0000000002ff',
  registration: 'D-EBPN',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  icaoTypeDesignator: 'P208',
  sourceUnit: 'kg',
  referenceDatumDescription: 'Leading edge of wing root',
  referenceDatumLocation: 'Station 0 m',
  shareCode: null,
  status: 'draft',
  schemaVersion: 1,
  powertrain: 'combustion',
  passengerProfiles: [],
  weighingReports: [
    { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot & Passenger',
      arm: 1.145,
      armLookup: [],
      operationalLimit: 110,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      mtom: 630,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.841, mass: 432 },
        { armOrMoment: 1.841, mass: 630 },
        { armOrMoment: 1.978, mass: 630 },
        { armOrMoment: 1.978, mass: 432 },
      ],
    },
  ],
}

// Profiles staged by `Given … already exists` for the next page-visit step to
// flush into IndexedDB. Keyed by the live Playwright `Page` so parallel
// scenarios cannot leak into each other.
const pendingSeeds = new WeakMap<Page, SeededProfile[]>()

function stageSeed(page: Page, profile: SeededProfile): void {
  const queue = pendingSeeds.get(page) ?? []
  queue.push(profile)
  pendingSeeds.set(page, queue)
}

async function flushSeeds(page: Page): Promise<void> {
  const queue = pendingSeeds.get(page) ?? []
  if (queue.length === 0) return
  pendingSeeds.delete(page)
  await page.evaluate(
    ({ dbName, storeName, profiles }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onerror = () => reject(req.error ?? new Error('open failed'))
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            reject(new Error(`Object store '${storeName}' not created yet`))
            return
          }
          const tx = db.transaction(storeName, 'readwrite')
          for (const p of profiles) tx.objectStore(storeName).put(p)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error ?? new Error('tx failed'))
          }
        }
      }),
    { dbName: FLEET_DB_NAME, storeName: FLEET_STORE_NAME, profiles: queue },
  )
}

Given(
  'a single Draft profile {string} already exists in the fleet',
  async ({ page }, registration: string) => {
    stageSeed(page, { ...SEED_PROFILE, registration })
  },
)

Given('the pilot is on the Fleet page', async ({ page }) => {
  // First visit lets the app open + migrate IndexedDB at whatever version
  // production currently uses.
  await page.goto('/fleet')
  await expect(page.locator('.fleet-list')).toBeVisible()
  await expect(page.locator('.loading-state')).toHaveCount(0)

  // Now flush any pending seed and reload so the FleetView re-renders with the
  // freshly-written rows.
  await flushSeeds(page)
  await page.reload()
  await expect(page.locator('.profile-item').first()).toBeVisible()
})

When(
  'the pilot taps {string} on the {string} row',
  async ({ page }, action: string, registration: string) => {
    const row = page.locator('.profile-item', { hasText: registration })
    await expect(row).toBeVisible()
    const button = row.getByRole('button', { name: new RegExp(`${action} ${registration}`, 'i') })
    await button.click()
  },
)

When('the pilot returns to the Fleet page using the browser back button', async ({ page }) => {
  await expect(page).toHaveURL(/\/fleet\/.*\/edit$/)
  await expect(page.getByRole('heading', { name: /Edit Aircraft/i })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/fleet$/)
  await expect(page.locator('.profile-item').first()).toBeVisible()
})

When('the device restores the Fleet page from the browser bfcache', async ({ page }) => {
  // Real bfcache restoration can only be triggered by browser navigation in
  // an isolated WebKit/iOS environment. Dispatching a synthetic
  // `PageTransitionEvent('pageshow', { persisted: true })` exercises the
  // exact same code path App.vue listens for — the bfcacheNonce-driven
  // RouterView remount — without needing a real WebKit project.
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await expect(page.locator('.profile-item').first()).toBeVisible()
})

Then(
  'tapping {string} on the {string} row opens the delete confirmation dialog naming {string}',
  async ({ page }, action: string, registration: string, expectedName: string) => {
    const row = page.locator('.profile-item', { hasText: registration })
    await expect(row).toBeVisible()
    const button = row.getByRole('button', { name: new RegExp(`${action} ${registration}`, 'i') })
    await expect(button).toBeEnabled()
    await button.click()
    const dialog = page.locator('.confirm-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(expectedName)
  },
)
