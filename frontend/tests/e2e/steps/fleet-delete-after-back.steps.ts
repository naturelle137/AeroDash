/**
 * Step definitions for fleet-delete-after-browser-back.feature
 *
 * The delete control on the Fleet list page must keep
 * firing its confirmation dialog after the pilot returns from the editor via
 * the browser back button or after the page is restored from the browser's
 * bfcache (iOS Safari swipe-back gesture).
 */

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { flushFleetSeed, stageFleetSeed } from '../fixtures/fleet-seed'

const { Given, When, Then } = createBdd()

// ─── Seed: write a Draft profile into IndexedDB after the app has opened it ──
//
// Driving the full six-step wizard for every scenario would shave minutes off
// the regression suite, so we write the profile directly into IndexedDB. The
// schema mirrors the canonical "Tecnam P2008 JC" fixture and validates
// against AircraftProfileSchema.

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

Given(
  'a single Draft profile {string} already exists in the fleet',
  async ({ page }, registration: string) => {
    stageFleetSeed(page, { ...SEED_PROFILE, registration })
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
  await flushFleetSeed(page)
  await page.reload()
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
