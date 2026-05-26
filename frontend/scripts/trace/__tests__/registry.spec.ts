import { describe, expect, it } from 'vitest'

import {
  diffRegistry,
  entryFromOccurrence,
  parseRegistry,
  serialiseRegistry,
} from '../lib/registry.mjs'

type Entry = ReturnType<typeof parseRegistry>[number]

describe('registry parser/serialiser', () => {
  const sample = [
    'MB Core Logic',
    '  IMP-MB-CORE-001',
    '    title: Zero Fuel Mass Calculation',
    '    req:',
    '      - REQ-MB-009',
    '    files:',
    '      - frontend/src/core/logic/mass-balance.logic.ts',
    '',
    '  IMP-MB-CORE-002',
    '    title: Takeoff Mass + Takeoff Moment Calculation',
    '    req:',
    '      - REQ-MB-008',
    '    files:',
    '      - frontend/src/core/logic/mass-balance.logic.ts',
    '',
  ].join('\n')

  it('parses entries grouped by group title', () => {
    const entries = parseRegistry(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      id: 'IMP-MB-CORE-001',
      group: 'MB Core Logic',
      scalars: { title: 'Zero Fuel Mass Calculation' },
    })
    expect(entries[0].lists.req).toEqual(['REQ-MB-009'])
    expect(entries[0].lists.files).toEqual([
      'frontend/src/core/logic/mass-balance.logic.ts',
    ])
  })

  it('serialises back without losing data', () => {
    const entries = parseRegistry(sample)
    const out = serialiseRegistry(entries)
    expect(out).toContain('MB Core Logic')
    expect(out).toContain('  IMP-MB-CORE-001')
    expect(out).toContain('    title: Zero Fuel Mass Calculation')
    expect(out).toContain('      - REQ-MB-009')
    // Re-parsing should round-trip.
    expect(parseRegistry(out)).toEqual(entries)
  })

  it('canonicalises legacy flat tombstones (e.g. bare `obsolete`) into a status scalar', () => {
    // Regression: pre-existing registry entries authored before STC §5.2
    // sometimes use a bare keyword `    obsolete` rather than `status:
    // obsolete`. The parser previously dropped the line silently, which
    // caused `sync --apply` to treat the tombstone as a stale entry and
    // remove it.
    const text = [
      'MB Core',
      '  IMP-MB-CORE-009',
      '    obsolete',
      '',
      '  IMP-MB-CORE-010',
      '    deleted',
      '',
      '  IMP-MB-CORE-011',
      '    pending',
      '',
    ].join('\n')
    const entries = parseRegistry(text)
    expect(entries.map((e) => e.scalars.status)).toEqual(['obsolete', 'deleted', 'pending'])
  })

  it('handles entries that carry only a scalar `file:` field', () => {
    const text = [
      'Architecture Design',
      '  DES-ARCH-001',
      '    title: Notification System Architecture',
      '    req:',
      '      - REQ-SYS-007',
      '    file: docs/architecture/notification_schema.md',
      '',
    ].join('\n')
    const entries = parseRegistry(text)
    expect(entries[0].scalars.file).toBe('docs/architecture/notification_schema.md')
    expect(entries[0].lists.req).toEqual(['REQ-SYS-007'])
  })
})

describe('diffRegistry', () => {
  function occ(id: string, file: string) {
    return {
      id: `@${id}@`,
      type: 'IMP' as const,
      segments: [],
      number: 0,
      file,
      line: 1,
      fromTags: [],
      technical: false,
    }
  }
  const registry = new Map<string, { entry: Entry; relPath: string }>()
  registry.set('IMP-MB-CORE-001', {
    entry: {
      id: 'IMP-MB-CORE-001',
      group: 'MB Core',
      scalars: { title: 'A' },
      lists: { files: ['frontend/src/core/logic/mass-balance.logic.ts'] },
    },
    relPath: 'trace/implementation/mb.yaml',
  })
  registry.set('IMP-MB-CORE-002', {
    entry: {
      id: 'IMP-MB-CORE-002',
      group: 'MB Core',
      scalars: { title: 'B' },
      lists: { files: ['frontend/src/core/logic/mass-balance.logic.ts'] },
    },
    relPath: 'trace/implementation/mb.yaml',
  })

  it('detects in-source-only entries', () => {
    const result = diffRegistry(
      [occ('IMP-MB-CORE-001', 'frontend/src/core/logic/mass-balance.logic.ts'),
       occ('IMP-MB-CORE-003', 'frontend/src/core/logic/new.ts')],
      registry,
    )
    expect(result.onlyInSource).toEqual(['IMP-MB-CORE-003'])
    expect(result.onlyInRegistry).toEqual(['IMP-MB-CORE-002'])
  })

  it('detects file-list mismatches', () => {
    const result = diffRegistry(
      [occ('IMP-MB-CORE-001', 'frontend/src/core/logic/moved-elsewhere.ts'),
       occ('IMP-MB-CORE-002', 'frontend/src/core/logic/mass-balance.logic.ts')],
      registry,
    )
    expect(result.fileMismatches).toHaveLength(1)
    expect(result.fileMismatches[0].id).toBe('IMP-MB-CORE-001')
  })

  it('ignores deleted/obsolete tombstones', () => {
    const tomb: Entry = {
      id: 'IMP-MB-CORE-099',
      group: 'MB Core',
      scalars: { status: 'deleted', note: 'Merged into 001' },
      lists: {},
    }
    const reg = new Map(registry)
    reg.set('IMP-MB-CORE-099', { entry: tomb, relPath: 'trace/implementation/mb.yaml' })
    const result = diffRegistry(
      [occ('IMP-MB-CORE-001', 'frontend/src/core/logic/mass-balance.logic.ts'),
       occ('IMP-MB-CORE-002', 'frontend/src/core/logic/mass-balance.logic.ts')],
      reg,
    )
    expect(result.onlyInRegistry).toEqual([])
  })
})

describe('entryFromOccurrence', () => {
  it('builds an IMP entry with req/des split', () => {
    const entry = entryFromOccurrence({
      id: '@IMP-MB-CORE-005@',
      type: 'IMP',
      segments: ['MB', 'CORE'],
      number: 5,
      file: 'frontend/src/core/logic/mass-balance.logic.ts',
      line: 12,
      fromTags: ['@REQ-MB-001@', '@DES-ARCH-002@'],
      technical: false,
    })
    expect(entry.id).toBe('IMP-MB-CORE-005')
    expect(entry.lists.req).toEqual(['REQ-MB-001'])
    expect(entry.lists.des).toEqual(['DES-ARCH-002'])
    expect(entry.lists.files).toEqual(['frontend/src/core/logic/mass-balance.logic.ts'])
  })

  it('builds a UT entry with impl trace', () => {
    const entry = entryFromOccurrence({
      id: '@UT-MB-CORE-001@',
      type: 'UT',
      segments: ['MB', 'CORE'],
      number: 1,
      file: 'frontend/src/core/logic/mass-balance.spec.ts',
      line: 5,
      fromTags: ['@IMP-MB-CORE-001@'],
      technical: false,
    })
    expect(entry.lists.impl).toEqual(['IMP-MB-CORE-001'])
  })
})
