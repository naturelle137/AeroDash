/**
 * Unit tests for useIncidentReportStore — validates that the store wires
 * the P1 redaction + URL builder + queue together correctly. The store's
 * IndexedDB I/O is exercised in incident-report.store.int.spec.ts.
 */

// @UT-SYS-STORE-200@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-201@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-202@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-203@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-204@ (FROM: @IMP-SYS-STORE-022@)

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { useIncidentReportStore } from '../incident-report.store'

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

describe('useIncidentReportStore.previewRedaction', () => {
  it('redacts an email and returns the count', () => {
    const store = useIncidentReportStore()
    const result = store.previewRedaction('Reach me at pilot@example.com')
    expect(result.redacted).toContain('[REDACTED-EMAIL]')
    expect(result.counts.email).toBe(1)
    expect(result.total).toBe(1)
  })

  it('returns zero redactions for safe text', () => {
    const store = useIncidentReportStore()
    const result = store.previewRedaction('Loaded 100 kg fuel.')
    expect(result.total).toBe(0)
    expect(result.redacted).toBe('Loaded 100 kg fuel.')
  })
})

describe('useIncidentReportStore.buildReport', () => {
  it('produces a fully-validated report with redaction applied', () => {
    const store = useIncidentReportStore()
    const report = store.buildReport(
      {
        kind: 'CALCULATION',
        summary: 'CG went amber after correct fuel entry',
        description: 'Loaded 100 kg pilot, contact me at pilot@example.com',
      },
      { routeName: 'mass-balance', now: new Date('2026-05-31T08:15:00Z') },
    )
    expect(report.kind).toBe('CALCULATION')
    expect(report.summary).toBe('CG went amber after correct fuel entry')
    expect(report.redactedDescription).toContain('[REDACTED-EMAIL]')
    expect(report.context.routeName).toBe('mass-balance')
    expect(report.schemaVersion).toBe(1)
    expect(report.createdAt).toBe('2026-05-31T08:15:00.000Z')
  })

  it('rejects a draft that fails Zod validation', () => {
    const store = useIncidentReportStore()
    expect(() =>
      store.buildReport({
        kind: 'OTHER',
        summary: 'no',
        description: 'too short',
      }),
    ).toThrow(/too small/i)
  })
})

describe('useIncidentReportStore.buildGithubUrl', () => {
  it('produces a deep link with the prefilled title and kind', () => {
    const store = useIncidentReportStore()
    const report = store.buildReport(
      {
        kind: 'CRASH',
        summary: 'App froze after fuel entry',
        description: 'The Mass & Balance page stopped responding entirely.',
      },
      { routeName: 'mass-balance' },
    )
    const url = store.buildGithubUrl(report)
    expect(url).toContain('github.com/naturelle137/AeroDash/issues/new')
    expect(decodeURIComponent(url)).toContain('[Incident] App froze after fuel entry')
    expect(decodeURIComponent(url)).toContain('App froze or failed to load')
  })
})
