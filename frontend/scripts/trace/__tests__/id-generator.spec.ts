import { describe, expect, it } from 'vitest'

import {
  findDanglingFromRefs,
  findDuplicates,
  namespaceKey,
  nextNumber,
  nextTagId,
  resolvePlaceholder,
  resolvePlaceholders,
} from '../lib/id-generator.mjs'

type Occurrence = import('../lib/parser.mjs').TagOccurrence

function occ(partial: Partial<Occurrence> & { id: string; type: Occurrence['type']; segments: string[]; number: number }): Occurrence {
  return {
    fromTags: [],
    technical: false,
    file: 'fake',
    line: 1,
    ...partial,
  }
}

describe('id-generator', () => {
  describe('namespaceKey', () => {
    it('groups by type and segment list', () => {
      expect(namespaceKey('IMP', ['MB', 'CORE'])).toBe('IMP::MB-CORE')
      expect(namespaceKey('IMP', ['MB', 'STORE'])).not.toBe(namespaceKey('IMP', ['MB', 'CORE']))
    })
  })

  describe('nextNumber', () => {
    const occurrences: Occurrence[] = [
      occ({ id: '@IMP-MB-CORE-001@', type: 'IMP', segments: ['MB', 'CORE'], number: 1 }),
      occ({ id: '@IMP-MB-CORE-002@', type: 'IMP', segments: ['MB', 'CORE'], number: 2 }),
      occ({ id: '@IMP-MB-STORE-001@', type: 'IMP', segments: ['MB', 'STORE'], number: 1 }),
      occ({ id: '@UT-MB-CORE-005@', type: 'UT', segments: ['MB', 'CORE'], number: 5 }),
    ]

    it('returns max+1 in the matching namespace', () => {
      expect(nextNumber(occurrences, 'IMP', ['MB', 'CORE'])).toBe(3)
      expect(nextNumber(occurrences, 'IMP', ['MB', 'STORE'])).toBe(2)
    })

    it('returns 1 for empty namespaces', () => {
      expect(nextNumber(occurrences, 'IMP', ['PF', 'CORE'])).toBe(1)
    })

    it('skips gaps (never reuses)', () => {
      const sparse = [
        occ({ id: '@IMP-AC-CORE-001@', type: 'IMP', segments: ['AC', 'CORE'], number: 1 }),
        occ({ id: '@IMP-AC-CORE-099@', type: 'IMP', segments: ['AC', 'CORE'], number: 99 }),
      ]
      expect(nextNumber(sparse, 'IMP', ['AC', 'CORE'])).toBe(100)
    })
  })

  describe('nextTagId', () => {
    it('returns a fully formatted id', () => {
      expect(nextTagId([], 'IMP', ['MB', 'CORE'])).toBe('@IMP-MB-CORE-001@')
    })
  })

  describe('resolvePlaceholder', () => {
    it('expands @IMP@ into a fresh id for the given segments', () => {
      const occurrences: Occurrence[] = [
        occ({ id: '@IMP-PF-CORE-003@', type: 'IMP', segments: ['PF', 'CORE'], number: 3 }),
      ]
      expect(
        resolvePlaceholder({ placeholder: '@IMP@', occurrences, segments: ['PF', 'CORE'] }),
      ).toBe('@IMP-PF-CORE-004@')
    })
  })

  describe('resolvePlaceholders', () => {
    it('rewrites every placeholder and increments numbers within the file', () => {
      const text = [
        '// @IMP@ (FROM: @REQ-MB-001@)',
        'export function a() {}',
        '// @IMP@ (FROM: @REQ-MB-001@)',
        'export function b() {}',
      ].join('\n')

      const { text: rewritten, replacements } = resolvePlaceholders({
        text,
        occurrences: [
          occ({ id: '@IMP-MB-CORE-001@', type: 'IMP', segments: ['MB', 'CORE'], number: 1 }),
        ],
        segments: ['MB', 'CORE'],
      })

      expect(replacements).toEqual([
        { placeholder: '@IMP@', generated: '@IMP-MB-CORE-002@' },
        { placeholder: '@IMP@', generated: '@IMP-MB-CORE-003@' },
      ])
      expect(rewritten).toContain('@IMP-MB-CORE-002@ (FROM: @REQ-MB-001@)')
      expect(rewritten).toContain('@IMP-MB-CORE-003@ (FROM: @REQ-MB-001@)')
    })

    it('does not touch already-resolved tags', () => {
      const text = '// @IMP-MB-CORE-007@ (FROM: @REQ-MB-001@)'
      const { text: rewritten, replacements } = resolvePlaceholders({
        text,
        occurrences: [],
        segments: ['MB', 'CORE'],
      })
      expect(replacements).toEqual([])
      expect(rewritten).toBe(text)
    })
  })

  describe('findDuplicates', () => {
    it('reports tags declared in more than one location', () => {
      const dupes = findDuplicates([
        occ({ id: '@IMP-MB-CORE-001@', type: 'IMP', segments: ['MB', 'CORE'], number: 1, file: 'a.ts', line: 1 }),
        occ({ id: '@IMP-MB-CORE-001@', type: 'IMP', segments: ['MB', 'CORE'], number: 1, file: 'b.ts', line: 1 }),
        occ({ id: '@IMP-MB-CORE-002@', type: 'IMP', segments: ['MB', 'CORE'], number: 2, file: 'a.ts', line: 5 }),
      ])
      expect(dupes).toHaveLength(1)
      expect(dupes[0].id).toBe('@IMP-MB-CORE-001@')
      expect(dupes[0].files).toEqual(['a.ts:1', 'b.ts:1'])
    })
  })

  describe('findDanglingFromRefs', () => {
    it('detects FROM ids that have no defined source', () => {
      const dangling = findDanglingFromRefs([
        occ({
          id: '@IMP-MB-CORE-001@',
          type: 'IMP',
          segments: ['MB', 'CORE'],
          number: 1,
          fromTags: ['@REQ-MB-999@'],
        }),
        occ({ id: '@REQ-MB-001@', type: 'REQ', segments: ['MB'], number: 1 }),
      ])
      expect(dangling).toEqual([
        { from: '@REQ-MB-999@', citedBy: '@IMP-MB-CORE-001@ (fake:1)' },
      ])
    })

    it('returns nothing when every FROM resolves', () => {
      const dangling = findDanglingFromRefs([
        occ({
          id: '@IMP-MB-CORE-001@',
          type: 'IMP',
          segments: ['MB', 'CORE'],
          number: 1,
          fromTags: ['@REQ-MB-001@'],
        }),
        occ({ id: '@REQ-MB-001@', type: 'REQ', segments: ['MB'], number: 1 }),
      ])
      expect(dangling).toEqual([])
    })
  })
})
