/**
 * Integration tests for useIncidentReportStore — exercises the full path
 * from a pilot-submitted draft through the P1 redactor into the IndexedDB
 * queue and back out on `loadAll()`. Mirrors the fleet repository int
 * pattern (refs #166): real IndexedDB via fake-indexeddb, real Pinia.
 */

// @IT-SYS-STORE-003@ (FROM: @IMP-SYS-STORE-022@, @IMP-SYS-SHARED-011@)

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { setActivePinia, createPinia } from 'pinia'
import { useIncidentReportStore } from '../incident-report.store'

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

describe('useIncidentReportStore — capture / list / remove lifecycle', () => {
  it('captures a redacted report and surfaces it via loadAll()', async () => {
    const store = useIncidentReportStore()
    await store.capture(
      {
        kind: 'CALCULATION',
        summary: 'CG amber after correct fuel entry',
        description: 'Loaded 100 kg pilot mass, contact me at pilot@example.com.',
      },
      { routeName: 'mass-balance' },
    )
    expect(store.queuedCount).toBe(1)
    expect(store.reports[0]?.redactedDescription).toContain('[REDACTED-EMAIL]')
    expect(store.reports[0]?.context.routeName).toBe('mass-balance')
  })

  it('removes one report and leaves the rest', async () => {
    const store = useIncidentReportStore()
    const a = await store.capture({
      kind: 'OTHER',
      summary: 'First report saved',
      description: 'A description long enough.',
    })
    await store.capture({
      kind: 'UI',
      summary: 'Second report saved',
      description: 'Another long-enough description.',
    })
    await store.remove(a.id)
    expect(store.queuedCount).toBe(1)
    expect(store.reports[0]?.summary).toBe('Second report saved')
  })

  it('clearAll wipes every queued report', async () => {
    const store = useIncidentReportStore()
    await store.capture({
      kind: 'OTHER',
      summary: 'First report saved',
      description: 'A description long enough.',
    })
    await store.capture({
      kind: 'OTHER',
      summary: 'Second report saved',
      description: 'Another long-enough description.',
    })
    const removed = await store.clearAll()
    expect(removed).toBe(2)
    expect(store.queuedCount).toBe(0)
    expect(store.isEmpty).toBe(true)
  })

  it('survives a reload by reading from IndexedDB on a fresh Pinia instance', async () => {
    const store1 = useIncidentReportStore()
    await store1.capture({
      kind: 'DATA',
      summary: 'POH default mass looked wrong',
      description: 'The pre-filled empty mass for this profile did not match POH.',
    })

    setActivePinia(createPinia())
    const store2 = useIncidentReportStore()
    await store2.loadAll()
    expect(store2.queuedCount).toBe(1)
    expect(store2.reports[0]?.summary).toBe('POH default mass looked wrong')
  })
})
