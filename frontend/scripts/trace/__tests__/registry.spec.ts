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

  // Regression for review B1 — parseRegistry previously did `entry = null`
  // on a group header without first pushing the in-progress entry, so the
  // last entry of every non-terminal group was silently dropped. Verified
  // before the fix against the real repo: `trace/implementation/mb.yaml`
  // lost 8 of 47 IMP entries, and `sync --apply` would overwrite the
  // curated titles with `TODO: describe this artifact` stubs.
  it('does not drop the last entry of a non-terminal group (B1 regression)', () => {
    const text = [
      'Group A',
      '  IMP-A-CORE-001',
      '    title: First in A',
      '  IMP-A-CORE-002',
      '    title: Last in A — was dropped pre-fix',
      '',
      'Group B',
      '  IMP-B-CORE-001',
      '    title: First in B',
      '',
    ].join('\n')

    const entries = parseRegistry(text)
    expect(entries.map((e) => e.id)).toEqual([
      'IMP-A-CORE-001',
      'IMP-A-CORE-002',
      'IMP-B-CORE-001',
    ])
    expect(entries[1].scalars.title).toBe('Last in A — was dropped pre-fix')
  })

  // Regression for review M1 — serialiseRegistry previously hoisted every
  // scalar above every list, so a curator who interleaved `title:` →
  // `req:` (list) → `file:` (scalar) would lose layout. Re-parsing the
  // output then re-serialising must produce the same bytes (idempotence).
  it('serialise → parse → serialise is idempotent across interleaved scalar/list layouts (M1 regression)', () => {
    const text = [
      'Architecture Design',
      '  DES-ARCH-001',
      '    title: Notification System Architecture',
      '    req:',
      '      - REQ-SYS-007',
      '      - REQ-SYS-008',
      '    file: docs/architecture/notification_schema.md',
      '',
      '  DES-ARCH-002',
      '    title: Second entry',
      '    files:',
      '      - docs/architecture/second.md',
      '    note: trailing scalar after list',
      '',
    ].join('\n')

    const first = serialiseRegistry(parseRegistry(text))
    const second = serialiseRegistry(parseRegistry(first))
    expect(second).toBe(first)
    // The interleaved layout MUST be preserved (title → req → file, not
    // title → file → req as the pre-fix serialiser produced).
    const reparsed = parseRegistry(first)
    expect(reparsed[0].fields?.map((f) => f.key)).toEqual(['title', 'req', 'file'])
    expect(reparsed[1].fields?.map((f) => f.key)).toEqual(['title', 'files', 'note'])
  })

  // Defensive m1 — a non-empty input that yields zero entries (e.g. a
  // tab-indented file the parser doesn't recognise) must throw rather
  // than let `sync --apply` blank the source by writing serialise([]).
  it('refuses to silently parse a non-empty input to zero entries (m1 defence)', () => {
    const tabbed = ['MB Core', '\tIMP-MB-CORE-001', '\t\ttitle: Tab-indented'].join('\n')
    expect(() => parseRegistry(tabbed)).toThrow(/no entries were extracted/)
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

  // Regression for review M2 — sync preserves `status: pending` per the
  // shared isTombstone predicate; diffRegistry must align so the gate
  // doesn't report a pending entry as `onlyInRegistry` drift.
  it('ignores status: pending tombstones (same predicate as sync)', () => {
    const pending: Entry = {
      id: 'IMP-MB-CORE-098',
      group: 'MB Core',
      scalars: { status: 'pending', note: 'Awaiting upstream milestone' },
      lists: {},
    }
    const reg = new Map(registry)
    reg.set('IMP-MB-CORE-098', { entry: pending, relPath: 'trace/implementation/mb.yaml' })
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

  // Regression for review m4-registry — hazard refs cited from IMPs were
  // silently dropped because the IMP branch only mapped req/des. They must
  // surface on a `hazard:` list parallel to REQ's hazard mapping.
  it('maps @H- FROM refs on an IMP onto a hazard: list', () => {
    const entry = entryFromOccurrence({
      id: '@IMP-MB-CORE-009@',
      type: 'IMP',
      segments: ['MB', 'CORE'],
      number: 9,
      file: 'frontend/src/core/logic/mass-balance.logic.ts',
      line: 42,
      fromTags: ['@REQ-MB-001@', '@H-007@'],
      technical: false,
    })
    expect(entry.lists.req).toEqual(['REQ-MB-001'])
    expect(entry.lists.hazard).toEqual(['H-007'])
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

  // Issue #264 — document-level registries (REQ/UJ/DES) must use a
  // singular `file:` scalar (STC §4.3.1) and pick up the heading title
  // harvested by the parser instead of falling back to the "TODO" stub.
  it('builds a REQ entry with extracted title, file: scalar, and hazard list', () => {
    const entry = entryFromOccurrence({
      id: '@REQ-MB-001@',
      type: 'REQ',
      segments: ['MB'],
      number: 1,
      file: 'docs/requirements/mass_balance.md',
      line: 10,
      fromTags: ['@H-005@'],
      technical: false,
      title: 'Dynamic Envelope Updates',
    })
    expect(entry.id).toBe('REQ-MB-001')
    expect(entry.group).toBe('Mass & Balance Requirements')
    expect(entry.scalars.title).toBe('Dynamic Envelope Updates')
    expect(entry.scalars.file).toBe('docs/requirements/mass_balance.md')
    expect(entry.lists.files).toBeUndefined()
    expect(entry.lists.hazard).toEqual(['H-005'])
  })

  it('builds a UJ entry with extracted title, file: scalar, and req list', () => {
    const entry = entryFromOccurrence({
      id: '@UJ-A-001@',
      type: 'UJ',
      segments: ['A'],
      number: 1,
      file: 'docs/journeys/01_fleet_management.md',
      line: 7,
      fromTags: ['@REQ-AC-001@', '@REQ-UQ-005@'],
      technical: false,
      title: 'The "Fleet Admin" Workflow (Complex Profile)',
    })
    expect(entry.id).toBe('UJ-A-001')
    expect(entry.group).toBe('Phase A — Fleet Management & Setup')
    expect(entry.scalars.title).toBe('The "Fleet Admin" Workflow (Complex Profile)')
    expect(entry.scalars.file).toBe('docs/journeys/01_fleet_management.md')
    expect(entry.lists.req).toEqual(['REQ-AC-001', 'REQ-UQ-005'])
  })

  it('falls back to a TODO title when no heading was harvested', () => {
    const entry = entryFromOccurrence({
      id: '@REQ-SYS-001@',
      type: 'REQ',
      segments: ['SYS'],
      number: 1,
      file: 'docs/requirements/system.md',
      line: 8,
      fromTags: [],
      technical: false,
    })
    expect(entry.scalars.title).toBe('TODO: describe this artifact')
    expect(entry.scalars.file).toBe('docs/requirements/system.md')
  })
})
