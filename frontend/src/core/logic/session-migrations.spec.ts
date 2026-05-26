/**
 * P1 unit tests for the session payload migration registry.
 *
 * Covers:
 *  - Current v1 payloads pass through unchanged
 *  - Pre-versioned (v0) payloads forward-stamped to v1
 *  - Unsupported future version (downgrade scenario, #259)
 *  - Corrupt inputs (non-objects, arrays, structurally invalid)
 *  - Purity / determinism
 *
 * @see frontend/src/core/logic/session-migrations.ts
 */

// @UT-SYS-CORE-101@ (FROM: @IMP-SYS-CORE-012@)

import { describe, it, expect } from 'vitest'
import {
  migrateSessionPayload,
} from './session-migrations'
import { CURRENT_SESSION_PAYLOAD_VERSION } from '../domain/session.schema'

function buildV1Payload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    version: 1,
    aircraftId: 'aircraft-uuid-A',
    activeCategory: 'Normal',
    stations: [
      { index: 0, weight: 75, touched: true, verified: false },
      { index: 1, weight: 0, touched: false, verified: false },
    ],
    savedAt: '2026-05-26T10:00:00.000Z',
    ...overrides,
  }
}

describe('migrateSessionPayload — current-version pass-through', () => {
  it('returns a parsed payload when version equals current', () => {
    const result = migrateSessionPayload(buildV1Payload())
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.payload.version).toBe(CURRENT_SESSION_PAYLOAD_VERSION)
    expect(result.versionsApplied).toEqual([])
  })

  it('preserves aircraftId, activeCategory, savedAt, and stations', () => {
    const result = migrateSessionPayload(buildV1Payload())
    if (result.kind !== 'migrated') throw new Error('expected migrated')
    expect(result.payload.aircraftId).toBe('aircraft-uuid-A')
    expect(result.payload.activeCategory).toBe('Normal')
    expect(result.payload.savedAt).toBe('2026-05-26T10:00:00.000Z')
    expect(result.payload.stations).toHaveLength(2)
    expect(result.payload.stations[0]!.weight).toBe(75)
  })
})

describe('migrateSessionPayload — v0 forward-stamping', () => {
  it('stamps version when the field is absent', () => {
    const payload = buildV1Payload()
    delete (payload as { version?: number }).version
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.payload.version).toBe(1)
    expect(result.versionsApplied).toEqual([0])
  })

  it('stamps version when the field is a string', () => {
    const payload = buildV1Payload({ version: '1' as unknown as number })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.payload.version).toBe(1)
  })

  it('stamps version when stored value is NaN', () => {
    const payload = buildV1Payload({ version: Number.NaN })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('migrated')
  })

  it('stamps version when stored value is negative', () => {
    const payload = buildV1Payload({ version: -2 })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('migrated')
  })
})

describe('migrateSessionPayload — unsupported future version', () => {
  it('reports unsupported-future-version when stored version > current', () => {
    const payload = buildV1Payload({ version: CURRENT_SESSION_PAYLOAD_VERSION + 1 })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('unsupported-future-version')
    if (result.kind !== 'unsupported-future-version') return
    expect(result.storedVersion).toBe(CURRENT_SESSION_PAYLOAD_VERSION + 1)
  })

  it('reports unsupported-future-version even when other fields are valid', () => {
    const payload = buildV1Payload({ version: 99 })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('unsupported-future-version')
  })

  it('does not call Zod for future-version payloads', () => {
    // A future payload may have a shape today's schema rejects. The walker
    // must report unsupported-future-version BEFORE Zod runs.
    const payload = buildV1Payload({
      version: 5,
      futureField: { nested: 'data' } as unknown,
    })
    const result = migrateSessionPayload(payload)
    expect(result.kind).toBe('unsupported-future-version')
  })
})

describe('migrateSessionPayload — corrupt input handling', () => {
  it('reports corrupt when input is null', () => {
    expect(migrateSessionPayload(null).kind).toBe('corrupt')
  })

  it('reports corrupt when input is undefined', () => {
    expect(migrateSessionPayload(undefined).kind).toBe('corrupt')
  })

  it('reports corrupt when input is a number', () => {
    expect(migrateSessionPayload(42).kind).toBe('corrupt')
  })

  it('reports corrupt when input is a string', () => {
    expect(migrateSessionPayload('payload').kind).toBe('corrupt')
  })

  it('reports corrupt when input is an array', () => {
    expect(migrateSessionPayload([1, 2, 3]).kind).toBe('corrupt')
  })

  it('reports corrupt with Zod summary when required fields are missing', () => {
    const result = migrateSessionPayload({ version: 1 })
    expect(result.kind).toBe('corrupt')
    if (result.kind !== 'corrupt') return
    expect(result.reason).toContain('schema validation failed')
  })

  it('reports corrupt when aircraftId is empty', () => {
    const result = migrateSessionPayload(buildV1Payload({ aircraftId: '' }))
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when stations has an entry with negative weight', () => {
    const result = migrateSessionPayload(
      buildV1Payload({ stations: [{ index: 0, weight: -1, touched: false, verified: false }] }),
    )
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when savedAt is not a valid ISO datetime', () => {
    const result = migrateSessionPayload(buildV1Payload({ savedAt: 'not-a-date' }))
    expect(result.kind).toBe('corrupt')
  })
})

describe('migrateSessionPayload — purity and determinism', () => {
  it('does not mutate the input payload', () => {
    const payload = buildV1Payload()
    delete (payload as { version?: number }).version
    const snapshot = JSON.stringify(payload)
    migrateSessionPayload(payload)
    expect(JSON.stringify(payload)).toBe(snapshot)
  })

  it('two invocations on the same input produce equal outputs', () => {
    const a = migrateSessionPayload(buildV1Payload())
    const b = migrateSessionPayload(buildV1Payload())
    expect(a).toEqual(b)
  })
})
