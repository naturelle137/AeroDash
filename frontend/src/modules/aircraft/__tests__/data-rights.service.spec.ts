/**
 * Unit tests for data-rights.service.ts — pure-function surface.
 * Heavier persistence-layer behaviour is covered by
 * `data-rights.service.int.spec.ts` (fake-indexeddb).
 *
 * @see frontend/src/modules/aircraft/services/data-rights.service.ts
 */

// @UT-SYS-STORE-046@ (FROM: @IMP-SYS-STORE-013@)

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RETENTION_DAYS,
  INDEXED_DB_FLEET_NAME,
  serializeBulkExport,
  type BulkExportEnvelope,
} from '../services/data-rights.service'

describe('data-rights.service constants', () => {
  it('exposes the IndexedDB fleet database name as a stable constant', () => {
    expect(INDEXED_DB_FLEET_NAME).toBe('aerodash-fleet')
  })

  it('defaults the retention window to 365 days (≈12 months)', () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(365)
  })
})

describe('serializeBulkExport', () => {
  it('emits pretty-printed JSON that round-trips through JSON.parse', () => {
    const envelope: BulkExportEnvelope = {
      exportSchemaVersion: 1,
      exportedAt: '2026-05-27T12:00:00.000Z',
      profileCount: 0,
      profiles: [],
    }
    const text = serializeBulkExport(envelope)
    expect(text).toContain('\n')
    const parsed = JSON.parse(text) as BulkExportEnvelope
    expect(parsed).toEqual(envelope)
  })
})
