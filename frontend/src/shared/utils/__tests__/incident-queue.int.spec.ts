// @IT-SYS-SHARED-001@ (FROM: @IMP-SYS-SHARED-011@)
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  clearAllReports,
  enqueueReport,
  listReports,
  removeReport,
} from '../incident-queue'
import type { IncidentReport } from '@/core/domain/incident-report.schema'

function buildReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: overrides.id ?? '00000000-0000-4000-a000-000000000001',
    createdAt: overrides.createdAt ?? '2026-05-31T08:15:00.000Z',
    kind: overrides.kind ?? 'OTHER',
    summary: overrides.summary ?? 'something happened',
    redactedDescription: overrides.redactedDescription ?? 'A redacted body.',
    context: overrides.context ?? {
      appVersion: '0.4.0-alpha',
      routeName: null,
      pathTail: null,
      userAgent: null,
      online: null,
    },
    schemaVersion: 1,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

describe('incident-queue', () => {
  it('starts empty', async () => {
    expect(await listReports()).toEqual([])
  })

  it('persists a report and reads it back', async () => {
    const r = buildReport()
    await enqueueReport(r)
    const list = await listReports()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(r.id)
  })

  it('sorts queued reports newest-first', async () => {
    await enqueueReport(
      buildReport({ id: '00000000-0000-4000-a000-000000000001', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
    await enqueueReport(
      buildReport({ id: '00000000-0000-4000-a000-000000000002', createdAt: '2026-05-31T00:00:00.000Z' }),
    )
    const list = await listReports()
    expect(list.map((r) => r.id)).toEqual([
      '00000000-0000-4000-a000-000000000002',
      '00000000-0000-4000-a000-000000000001',
    ])
  })

  it('rejects a malformed report at the boundary', async () => {
    const broken = { ...buildReport(), schemaVersion: 99 as unknown as 1 }
    await expect(enqueueReport(broken)).rejects.toThrow(/malformed incident report/i)
    expect(await listReports()).toEqual([])
  })

  it('removeReport drops the matching row', async () => {
    await enqueueReport(buildReport({ id: '00000000-0000-4000-a000-00000000000a' }))
    await enqueueReport(buildReport({ id: '00000000-0000-4000-a000-00000000000b' }))
    await removeReport('00000000-0000-4000-a000-00000000000a')
    const list = await listReports()
    expect(list.map((r) => r.id)).toEqual(['00000000-0000-4000-a000-00000000000b'])
  })

  it('clearAllReports wipes the store and reports the count', async () => {
    await enqueueReport(buildReport({ id: '00000000-0000-4000-a000-00000000000a' }))
    await enqueueReport(buildReport({ id: '00000000-0000-4000-a000-00000000000b' }))
    const removed = await clearAllReports()
    expect(removed).toBe(2)
    expect(await listReports()).toEqual([])
  })
})
