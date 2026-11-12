import type { Page } from '@playwright/test'

const FLEET_DB_NAME = 'aerodash-fleet'
const FLEET_STORE_NAME = 'aircraft_profiles'

// Profiles staged by a `Given` step for the next page-visit step to flush into
// IndexedDB. Keyed by the live Playwright `Page` so parallel scenarios cannot
// leak into each other.
const pendingSeeds = new WeakMap<Page, object[]>()

export function stageFleetSeed(page: Page, ...profiles: object[]): void {
  pendingSeeds.set(page, [...(pendingSeeds.get(page) ?? []), ...profiles])
}

export function hasPendingFleetSeed(page: Page): boolean {
  return (pendingSeeds.get(page)?.length ?? 0) > 0
}

// Must run after the app has opened the database: opening without a version
// piggybacks on the production schema instead of duplicating DB_VERSION.
export async function flushFleetSeed(page: Page): Promise<void> {
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

export async function readStoredProfile(page: Page, registration: string): Promise<unknown> {
  return page.evaluate(
    ({ dbName, storeName, reg }) =>
      new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onerror = () => reject(req.error ?? new Error('open failed'))
        req.onsuccess = () => {
          const db = req.result
          const all = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
          all.onsuccess = () => {
            db.close()
            resolve((all.result as { registration?: string }[]).find((p) => p.registration === reg))
          }
          all.onerror = () => {
            db.close()
            reject(all.error ?? new Error('read failed'))
          }
        }
      }),
    { dbName: FLEET_DB_NAME, storeName: FLEET_STORE_NAME, reg: registration },
  )
}
