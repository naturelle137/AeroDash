// @UT-SYS-CORE-112@ (FROM: @IMP-SYS-CORE-013@)
import { describe, it, expect } from 'vitest'
import {
  DESCRIPTION_MAX_LEN,
  IncidentDraftSchema,
  IncidentKindSchema,
  IncidentReportSchema,
  SUMMARY_MAX_LEN,
} from './incident-report.schema'

describe('IncidentKindSchema', () => {
  it('accepts every taxonomy entry', () => {
    for (const kind of ['CALCULATION', 'DATA', 'UI', 'CRASH', 'OTHER'] as const) {
      expect(IncidentKindSchema.parse(kind)).toBe(kind)
    }
  })

  it('rejects unknown kinds', () => {
    expect(() => IncidentKindSchema.parse('PANIC')).toThrow(/invalid option|expected/i)
  })
})

describe('IncidentDraftSchema', () => {
  it('parses a minimal valid draft', () => {
    const parsed = IncidentDraftSchema.parse({
      kind: 'CALCULATION',
      summary: 'CG went amber',
      description: 'Loaded fuel and pilot mass; envelope flipped.',
    })
    expect(parsed.summary).toBe('CG went amber')
  })

  it('rejects summary below the minimum length', () => {
    expect(() =>
      IncidentDraftSchema.parse({
        kind: 'OTHER',
        summary: 'ab',
        description: 'A description long enough.',
      }),
    ).toThrow(/too small/i)
  })

  it('rejects summary above the maximum length', () => {
    expect(() =>
      IncidentDraftSchema.parse({
        kind: 'OTHER',
        summary: 'x'.repeat(SUMMARY_MAX_LEN + 1),
        description: 'A description long enough.',
      }),
    ).toThrow(/too big/i)
  })

  it('rejects description above the maximum length', () => {
    expect(() =>
      IncidentDraftSchema.parse({
        kind: 'OTHER',
        summary: 'fine summary',
        description: 'x'.repeat(DESCRIPTION_MAX_LEN + 1),
      }),
    ).toThrow(/too big/i)
  })
})

describe('IncidentReportSchema', () => {
  const valid = {
    id: '00000000-0000-4000-a000-000000000001',
    createdAt: '2026-05-31T08:15:00.000Z',
    kind: 'OTHER' as const,
    summary: 'something happened',
    redactedDescription: 'A redacted body.',
    context: {
      appVersion: '0.4.0-alpha',
      routeName: null,
      pathTail: null,
      userAgent: null,
      online: null,
    },
    schemaVersion: 1 as const,
  }

  it('accepts a well-formed report', () => {
    expect(IncidentReportSchema.parse(valid)).toEqual(valid)
  })

  it('rejects a non-UUID id', () => {
    expect(() => IncidentReportSchema.parse({ ...valid, id: 'nope' })).toThrow(
      /uuid|invalid string/i,
    )
  })

  it('rejects schemaVersion values other than 1', () => {
    expect(() =>
      IncidentReportSchema.parse({ ...valid, schemaVersion: 2 as unknown as 1 }),
    ).toThrow(/expected|literal|invalid/i)
  })

  it('rejects malformed ISO timestamps', () => {
    expect(() => IncidentReportSchema.parse({ ...valid, createdAt: 'yesterday' })).toThrow(
      /datetime|iso|invalid string/i,
    )
  })
})
