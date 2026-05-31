/**
 * Offline-queued IndexedDB persistence for in-app incident reports
 * (issue #281, PR-006). P3 — browser API, no Vue/Pinia framework imports.
 *
 * Database: aerodash-incidents, version 1.
 * Object store: reports, keyPath: id (UUID v4).
 *
 * The queue holds redacted reports until the pilot opens GitHub and
 * confirms submission. Reports are NEVER sent automatically — submission
 * requires an explicit pilot action because the destination is github.com,
 * which is outside the GDPR data perimeter the rest of AeroDash maintains.
 *
 * Each row is round-tripped through {@link IncidentReportSchema} on read;
 * a row whose `schemaVersion` is from a future build (PWA-cache rollback)
 * is dropped from the in-memory queue but left on disk so the future
 * build can read it back when the pilot updates.
 *
 * Pattern mirrors `modules/aircraft/services/fleet.repository.ts`.
 */

import {
  IncidentReportSchema,
  type IncidentReport,
} from '@/core/domain/incident-report.schema'

// @IMP-SYS-SHARED-011@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@)

export const DB_NAME = 'aerodash-incidents'
const DB_VERSION = 1
const STORE_NAME = 'reports'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }
    request.onerror = (event) => {
      reject(
        new Error(
          `Failed to open incident IndexedDB: ${
            (event.target as IDBOpenDBRequest).error?.message ?? 'unknown'
          }`,
        ),
      )
    }
  })
}

function runRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

/** Persist a redacted report. Validates BEFORE writing so a malformed
 *  row never reaches the store and so the public surface never lies about
 *  what is on disk. */
export async function enqueueReport(report: IncidentReport): Promise<void> {
  const parsed = IncidentReportSchema.safeParse(report)
  if (!parsed.success) {
    throw new Error(`Refusing to queue malformed incident report: ${parsed.error.message}`)
  }
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await runRequest(store.put(parsed.data))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'))
    })
  } finally {
    db.close()
  }
}

/** All queued reports, newest-first by `createdAt`. Rows that fail schema
 *  validation are silently dropped from the returned list (see file header
 *  for rationale) but left on disk. */
export async function listReports(): Promise<IncidentReport[]> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const raw = await runRequest(store.getAll())
    const valid: IncidentReport[] = []
    for (const row of raw as unknown[]) {
      const parsed = IncidentReportSchema.safeParse(row)
      if (parsed.success) valid.push(parsed.data)
    }
    valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return valid
  } finally {
    db.close()
  }
}

/** Delete one report by id. No-op if the id is unknown. */
export async function removeReport(id: string): Promise<void> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await runRequest(store.delete(id))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'))
    })
  } finally {
    db.close()
  }
}

/** Wipe every queued report. Invoked by Privacy "Delete all data". */
export async function clearAllReports(): Promise<number> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const count = await runRequest(store.count())
    await runRequest(store.clear())
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'))
    })
    return count
  } finally {
    db.close()
  }
}
