// @IMP-AC-TEST-FIXTURE-002@ (FROM: @REQ-AC-001@, @REQ-MB-002@)
//
// E2E fleet-seeding fixture (refs #294).
//
// The Flight-Prep page now reads its aircraft dropdown from the IndexedDB fleet
// (`fleetStore.profiles`), not the legacy hardcoded `AIRCRAFT_CATALOGUE`. The
// four critical Mass & Balance journeys (happy-path, overweight-discovery,
// burnout-check, burn-sequence-polygon) each `select aircraft "D-…"` a
// pre-existing registration that no test created — so they could never pass.
//
// `seedFleet()` writes the registrations below directly into the
// `aerodash-fleet` IndexedDB store *before* the M&B view hydrates, so the
// dropdown is populated when the scenario runs. The four airframes mirror the
// known-good values in `src/modules/mass-balance/data/aircraft-catalogue.ts`
// (the data the journeys were authored against) translated into the
// `AircraftProfile` (fleet aggregate-root) field names — `bem`/`mtom` rather
// than `basicEmptyMass`/`maxTakeoffMass`.
//
// Each profile is seeded as `verified` with NO `verification` provenance block,
// i.e. "verified-unattributed": `evaluateVerificationFreshness` returns
// `requiresReverification: false`, so selecting it loads straight into the M&B
// store with no draft/expired acknowledgement gate (which the math journeys do
// not drive). Documents are validated against `AircraftProfileSchema` on read
// by the repository's migration registry — an invalid seed is dropped, which
// surfaces immediately as an empty dropdown.

import type { Page } from '@playwright/test'
import type { AircraftProfile } from '../../../src/core/adapters/aircraft.schema'

// Mirror of `fleet.repository.ts` storage coordinates. Kept inline (not imported)
// because the seed runs in the browser page context via `page.evaluate`.
const DB_NAME = 'aerodash-fleet'
const DB_VERSION = 2
const STORE_NAME = 'aircraft_profiles'

/** Shared owner for every seeded airframe — value is irrelevant to M&B math. */
const SEED_OWNER_ID = '00000000-0000-4000-8000-000000000000'

/**
 * D-EBPN — Tecnam P2008 JC. Happy-path (E2E-B-001 / UJ-B-005):
 * Pilot & Passenger / Baggage / Fuel within limits → VERIFIED SAFE.
 */
const TECNAM_P2008_DEBPN: AircraftProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: SEED_OWNER_ID,
  registration: 'D-EBPN',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  icaoTypeDesignator: 'P208',
  sourceUnit: 'kg',
  referenceDatumDescription: 'Wing leading edge',
  referenceDatumLocation: 'Datum',
  shareCode: null,
  status: 'verified',
  schemaVersion: 1,
  passengerProfiles: [],
  powertrain: 'combustion',
  weighingReports: [
    { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot & Passenger',
      arm: 1.8,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 90,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Baggage',
      arm: 2.417,
      armLookup: [],
      operationalLimit: 20,
      defaultQuantity: 5,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 2.209,
      armLookup: [],
      operationalLimit: 75,
      defaultQuantity: 60,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: {
        unusableFuel: 3,
        permissibleFuelTypes: ['MoGas', 'AvGas 100LL'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      mtom: 650,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.841, mass: 432 },
        { armOrMoment: 1.841, mass: 650 },
        { armOrMoment: 1.978, mass: 650 },
        { armOrMoment: 1.978, mass: 432 },
      ],
    },
  ],
}

/**
 * D-ECSM — Cessna 172S Skyhawk SP. Overweight-discovery (E2E-B-004/005,
 * UJ-B-003) and certification-category-switch (E2E-A-001, UJ-A-003):
 * MTOM/MZFM limits, Normal vs Utility category, Normal-only rear seats.
 */
const CESSNA_172S_DECSM: AircraftProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerId: SEED_OWNER_ID,
  registration: 'D-ECSM',
  manufacturer: 'Cessna',
  model: '172S Skyhawk SP',
  icaoTypeDesignator: 'C172',
  sourceUnit: 'kg',
  referenceDatumDescription: 'Forward datum (36.4 in ahead of firewall)',
  referenceDatumLocation: 'Forward datum',
  shareCode: null,
  status: 'verified',
  schemaVersion: 1,
  passengerProfiles: [],
  powertrain: 'combustion',
  weighingReports: [
    { bem: 680, emptyCg: 2.083, weighingDate: '2025-09-15', validFrom: '2025-09-15' },
  ],
  loadPoints: [
    {
      name: 'Front Seats',
      arm: 2.045,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Rear Seats',
      arm: 2.997,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Baggage Area 1',
      arm: 3.607,
      armLookup: [],
      operationalLimit: 54,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Baggage Area 2',
      arm: 3.886,
      armLookup: [],
      operationalLimit: 23,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Fuel Tanks',
      arm: 2.413,
      armLookup: [],
      operationalLimit: 153,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: {
        unusableFuel: 6,
        permissibleFuelTypes: ['AvGas 100LL', 'AvGas UL91'],
        burnSequences: [{ sequenceName: 'Standard', ordinalPosition: 1 }],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      mtom: 1111,
      maxZeroFuelMass: 1085,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 2.021, mass: 680 },
        { armOrMoment: 2.085, mass: 800 },
        { armOrMoment: 2.085, mass: 1111 },
        { armOrMoment: 2.362, mass: 1111 },
        { armOrMoment: 2.362, mass: 680 },
      ],
    },
    {
      category: 'Utility',
      mtom: 953,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 2.021, mass: 680 },
        { armOrMoment: 2.085, mass: 800 },
        { armOrMoment: 2.085, mass: 953 },
        { armOrMoment: 2.286, mass: 953 },
        { armOrMoment: 2.286, mass: 680 },
      ],
    },
  ],
}

/**
 * D-EAMB — Piper PA-28-161 Warrior III. Burnout-check (E2E-B-002/003, UJ-B-001):
 * aft CG migration during fuel burn-off, resolved by redistributing forward.
 */
const PIPER_PA28_DEAMB: AircraftProfile = {
  id: '33333333-3333-4333-8333-333333333333',
  ownerId: SEED_OWNER_ID,
  registration: 'D-EAMB',
  manufacturer: 'Piper',
  model: 'PA-28-161 Warrior III',
  icaoTypeDesignator: 'P28A',
  sourceUnit: 'kg',
  referenceDatumDescription: 'Wing leading edge',
  referenceDatumLocation: 'Datum',
  shareCode: null,
  status: 'verified',
  schemaVersion: 1,
  passengerProfiles: [],
  powertrain: 'combustion',
  weighingReports: [
    { bem: 556, emptyCg: 2.16, weighingDate: '2025-06-12', validFrom: '2025-06-12' },
  ],
  loadPoints: [
    {
      name: 'Front Seats',
      arm: 2.054,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Rear Seats',
      arm: 2.921,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Baggage',
      arm: 3.556,
      armLookup: [],
      operationalLimit: 91,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Fuel Tanks',
      arm: 1.87,
      armLookup: [],
      operationalLimit: 131,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: {
        unusableFuel: 3,
        permissibleFuelTypes: ['AvGas 100LL', 'AvGas UL91'],
        burnSequences: [{ sequenceName: 'Standard', ordinalPosition: 1 }],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      mtom: 1055,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 2.08, mass: 556 },
        { armOrMoment: 2.13, mass: 1055 },
        { armOrMoment: 2.37, mass: 1055 },
        { armOrMoment: 2.37, mass: 556 },
      ],
    },
  ],
}

/**
 * D-EMTK — Robin DR400/120 Petit Prince. Burn-sequence-polygon (E2E-B-006/007,
 * UJ-B-004): forward + aft tanks with two burn sequences reveal a CG-migration
 * polygon that a single-line trend hides.
 */
const ROBIN_DR400_DEMTK: AircraftProfile = {
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: SEED_OWNER_ID,
  registration: 'D-EMTK',
  manufacturer: 'Robin',
  model: 'DR400/120 Petit Prince',
  icaoTypeDesignator: 'DR40',
  sourceUnit: 'kg',
  referenceDatumDescription: 'Wing leading edge',
  referenceDatumLocation: 'Datum',
  shareCode: null,
  status: 'verified',
  schemaVersion: 1,
  passengerProfiles: [],
  powertrain: 'combustion',
  weighingReports: [
    { bem: 560, emptyCg: 1.8, weighingDate: '2025-04-20', validFrom: '2025-04-20' },
  ],
  loadPoints: [
    {
      name: 'Front Seats',
      arm: 1.6,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Rear Seats',
      arm: 2.7,
      armLookup: [],
      operationalLimit: 120,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Baggage',
      arm: 3.4,
      armLookup: [],
      operationalLimit: 30,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Forward Tank',
      arm: 0.8,
      armLookup: [],
      operationalLimit: 43,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: {
        unusableFuel: 1,
        permissibleFuelTypes: ['AvGas 100LL', 'AvGas UL91'],
        burnSequences: [
          { sequenceName: 'Standard', ordinalPosition: 2 },
          { sequenceName: 'Alternative', ordinalPosition: 1 },
        ],
      },
    },
    {
      name: 'Aft Tank',
      arm: 3.2,
      armLookup: [],
      operationalLimit: 43,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: {
        unusableFuel: 1,
        permissibleFuelTypes: ['AvGas 100LL', 'AvGas UL91'],
        burnSequences: [
          { sequenceName: 'Standard', ordinalPosition: 1 },
          { sequenceName: 'Alternative', ordinalPosition: 2 },
        ],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      mtom: 900,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.55, mass: 560 },
        { armOrMoment: 1.65, mass: 900 },
        { armOrMoment: 1.97, mass: 900 },
        { armOrMoment: 1.97, mass: 560 },
      ],
    },
  ],
}

/** The four pre-seeded airframes the @module-mb Flight-Prep journeys select. */
export const MB_E2E_FLEET: readonly AircraftProfile[] = [
  TECNAM_P2008_DEBPN,
  CESSNA_172S_DECSM,
  PIPER_PA28_DEAMB,
  ROBIN_DR400_DEMTK,
]

/**
 * Seed the given AircraftProfile documents into the app's IndexedDB fleet store
 * for the current browser context. Must run before the M&B view hydrates its
 * fleet (i.e. before the scenario navigates to `/mass-balance`).
 *
 * Self-contained: opens `aerodash-fleet` at the repository's version and creates
 * the object store + indexes if the app has not already, then `put`s each
 * record in a single readwrite transaction. Resolves once the transaction
 * commits, guaranteeing the records are durable before the next navigation.
 */
export async function seedFleet(
  page: Page,
  profiles: readonly AircraftProfile[] = MB_E2E_FLEET,
): Promise<void> {
  // IndexedDB is per-origin: navigate onto the app origin first. The home route
  // does not touch the fleet DB, so this never races the app's own loader.
  if (new URL(page.url() || 'about:blank').protocol === 'about:') {
    await page.goto('/')
  }

  await page.evaluate(
    async ({ dbName, dbVersion, storeName, records }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion)
        req.onupgradeneeded = () => {
          const database = req.result
          if (!database.objectStoreNames.contains(storeName)) {
            const store = database.createObjectStore(storeName, { keyPath: 'id' })
            store.createIndex('ownerId', 'ownerId', { unique: false })
            store.createIndex('registration', 'registration', { unique: false })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          for (const record of records) store.put(record)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, records: profiles },
  )
}
