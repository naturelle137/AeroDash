/**
 * Step definitions for the Performance & Safety (phase C) journey.
 *
 * A Verified aircraft carrying a regular POH performance grid is written
 * directly into IndexedDB — the wizard cannot yet enter performance tables, and
 * driving it per scenario would be slow. The grid maxima (temperature 50 °C,
 * pressure altitude 10 000 ft) match the UJ-C-001 narrative so 54 °C lands
 * inside the 10% extrapolation band and 57 °C / 11 100 ft fall beyond it.
 * E2E trace tags live in the `.feature` file only (STC §B.3 / §3.4).
 */

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

const FLEET_DB_NAME = 'aerodash-fleet'
const FLEET_STORE_NAME = 'aircraft_profiles'

interface PerfModel {
  base: number
  mass: number
  alt: number
  temp: number
}

const PERF_MODELS: Record<string, PerfModel> = {
  TakeoffRoll: { base: 250, mass: 150, alt: 200, temp: 100 },
  TakeoffDistance50ft: { base: 450, mass: 200, alt: 350, temp: 150 },
  LandingRoll: { base: 200, mass: 80, alt: 120, temp: 60 },
  LandingDistance50ft: { base: 380, mass: 120, alt: 220, temp: 100 },
}

const MASS_AXIS = [600, 1000]
const ALT_AXIS = [0, 10_000]
const TEMP_AXIS = [0, 50]

function buildDataPoints(model: PerfModel): Array<{
  mass: number
  pressureAltitude: number
  temperature: number
  distance: number
}> {
  const points = []
  for (const temperature of TEMP_AXIS) {
    for (const pressureAltitude of ALT_AXIS) {
      for (const mass of MASS_AXIS) {
        const massFrac = (mass - MASS_AXIS[0]!) / (MASS_AXIS[1]! - MASS_AXIS[0]!)
        const altFrac = pressureAltitude / ALT_AXIS[1]!
        const tempFrac = temperature / TEMP_AXIS[1]!
        points.push({
          mass,
          pressureAltitude,
          temperature,
          distance: model.base + model.mass * massFrac + model.alt * altFrac + model.temp * tempFrac,
        })
      }
    }
  }
  return points
}

function buildVerifiedPerformanceProfile(registration: string): Record<string, unknown> {
  return {
    id: '00000000-0000-4000-a000-000000000311',
    ownerId: '00000000-0000-4000-a000-0000000003ff',
    registration,
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge of wing root',
    referenceDatumLocation: 'Station 0 m',
    shareCode: null,
    status: 'verified',
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
    performanceProfiles: Object.entries(PERF_MODELS).map(([flightPhase, model]) => ({
      flightPhase,
      dataPoints: buildDataPoints(model),
    })),
  }
}

const pendingSeeds = new WeakMap<Page, Record<string, unknown>[]>()

function stageSeed(page: Page, profile: Record<string, unknown>): void {
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
  'the pilot has a Verified aircraft {string} with published performance data',
  async ({ page }, registration: string) => {
    stageSeed(page, buildVerifiedPerformanceProfile(registration))
  },
)

Given('the pilot opens the Performance page', async ({ page }) => {
  await page.goto('/performance')
  await expect(page.getByRole('heading', { level: 1, name: 'Performance' })).toBeVisible()
  await flushSeeds(page)
  await page.reload()
  await expect(page.getByLabel('Select aircraft')).toBeVisible()
})

Given('the pilot selects {string} for performance planning', async ({ page }, registration: string) => {
  const select = page.getByLabel('Select aircraft')
  const option = select.locator('option', { hasText: registration })
  const label = await option.textContent()
  await select.selectOption({ label: label!.trim() })
  await expect(page.getByText('Conditions', { exact: false })).toBeVisible()
})

When(
  'the pilot enters conditions mass {int} kg, pressure altitude {int} ft, temperature {int} °C',
  async ({ page }, mass: number, pa: number, temp: number) => {
    await page.locator('#perf-mass').fill(String(mass))
    await page.locator('#perf-pa').fill(String(pa))
    await page.locator('#perf-temp').fill(String(temp))
  },
)

When('the pilot sets the available runway to {int} m', async ({ page }, distance: number) => {
  await page.locator('#perf-tora').fill(String(distance))
  await page.locator('#perf-lda').fill(String(distance))
})

Then('the result is flagged as extrapolated beyond the POH limits', async ({ page }) => {
  await expect(page.locator('.extrapolation-ack')).toBeVisible()
  await expect(page.locator('.extrapolation-ack')).toContainText(/extrapolated/i)
})

Then('the advisory is withheld until the extrapolation is acknowledged', async ({ page }) => {
  await expect(page.locator('.perf-advisory--pending')).toBeVisible()
})

When('the pilot acknowledges the extrapolated data as Pilot-in-Command', async ({ page }) => {
  await page.locator('.extrapolation-ack__btn').click()
})

Then('a runway-sufficiency advisory is shown', async ({ page }) => {
  await expect(page.locator('.extrapolation-ack')).toHaveCount(0)
  await expect(page.locator('.perf-advisory--go, .perf-advisory--nogo')).toBeVisible()
})

Then(
  'the calculation is blocked because conditions exceed the extrapolation boundary',
  async ({ page }) => {
    await expect(page.locator('.notification--error')).toBeVisible()
    await expect(page.locator('.perf-results')).toHaveCount(0)
  },
)
