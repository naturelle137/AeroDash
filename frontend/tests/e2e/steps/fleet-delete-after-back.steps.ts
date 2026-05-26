/**
 * Step definitions for fleet-delete-after-browser-back.feature
 *
 * Issue #232 regression. The delete control on the Fleet list page must keep
 * firing its confirmation dialog after the pilot returns from the editor via
 * the browser back button or after the page is restored from the browser's
 * bfcache (iOS Safari swipe-back gesture). E2E trace tags live in the
 * `.feature` file only (STC §B.3 / §3.4).
 */

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

// ─── Seed: write a Draft profile straight into IndexedDB before page load ──
//
// Using IndexedDB seeding (rather than driving the full 5-step wizard) keeps
// the scenario focused on the navigation regression and shaves the test from
// minutes to seconds. The schema mirrors the canonical "Tecnam P2008 JC"
// fixture and validates against AircraftProfileSchema.

const SEED_PROFILE = {
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

Given('a single Draft profile {string} already exists in the fleet', async ({ page }, registration: string) => {
  const profile = { ...SEED_PROFILE, registration }
  await page.addInitScript((p) => {
    const req = indexedDB.open('aerodash-fleet', 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('aircraft_profiles')) {
        const store = db.createObjectStore('aircraft_profiles', { keyPath: 'id' })
        store.createIndex('ownerId', 'ownerId', { unique: false })
        store.createIndex('registration', 'registration', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('aircraft_profiles', 'readwrite')
      tx.objectStore('aircraft_profiles').put(p)
    }
  }, profile)
})

Given('the pilot is on the Fleet page', async ({ page }) => {
  await page.goto('/fleet')
  await expect(page.locator('.profile-item').first()).toBeVisible()
})

When('the pilot taps {string} on the {string} row', async ({ page }, action: string, registration: string) => {
  const row = page.locator('.profile-item', { hasText: registration })
  await expect(row).toBeVisible()
  const button = row.getByRole('button', { name: new RegExp(`${action} ${registration}`, 'i') })
  await button.click()
})

When('the pilot returns to the Fleet page using the browser back button', async ({ page }) => {
  await expect(page).toHaveURL(/\/fleet\/.*\/edit$/)
  await expect(page.getByRole('heading', { name: /Edit Aircraft/i })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/fleet$/)
  await expect(page.locator('.profile-item').first()).toBeVisible()
})

When('the device restores the Fleet page from the browser bfcache', async ({ page }) => {
  // Real bfcache restoration can only be triggered by browser navigation in
  // an isolated WebKit/iOS environment. Dispatching a synthetic `pageshow`
  // with `persisted=true` exercises the exact same code path App.vue listens
  // for — the bfcacheNonce-driven RouterView remount — and that is what we
  // need to assert here.
  await page.evaluate(() => {
    const event = new Event('pageshow') as Event & { persisted?: boolean }
    Object.defineProperty(event, 'persisted', { value: true, configurable: true })
    window.dispatchEvent(event)
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
