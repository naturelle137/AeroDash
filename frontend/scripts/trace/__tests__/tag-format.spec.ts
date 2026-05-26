import { describe, expect, it } from 'vitest'

import {
  buildComment,
  commentStyleFor,
  formatTag,
  padNumber,
  parseAnnotations,
  parseTag,
} from '../lib/tag-format.mjs'

describe('tag-format', () => {
  describe('padNumber', () => {
    it('pads single-digit numbers to three places', () => {
      expect(padNumber(1)).toBe('001')
      expect(padNumber(42)).toBe('042')
      expect(padNumber(999)).toBe('999')
    })

    it('keeps four-digit numbers untouched', () => {
      expect(padNumber(1234)).toBe('1234')
    })

    it('rejects non-integers and negatives', () => {
      expect(() => padNumber(-1)).toThrow(/Invalid tag number/)
      expect(() => padNumber(1.5)).toThrow(/Invalid tag number/)
    })
  })

  describe('formatTag', () => {
    it('builds canonical @IMP-MB-CORE-001@ form', () => {
      expect(formatTag({ type: 'IMP', segments: ['MB', 'CORE'], number: 1 })).toBe(
        '@IMP-MB-CORE-001@',
      )
    })

    it('builds @REQ-MB-005@ with a single segment', () => {
      expect(formatTag({ type: 'REQ', segments: ['MB'], number: 5 })).toBe('@REQ-MB-005@')
    })

    it('builds @H-006@ with no segments', () => {
      expect(formatTag({ type: 'H', segments: [], number: 6 })).toBe('@H-006@')
    })

    it('rejects lowercase segments', () => {
      expect(() =>
        formatTag({ type: 'IMP', segments: ['mb', 'CORE'], number: 1 }),
      ).toThrow(/uppercase/)
    })
  })

  describe('parseTag', () => {
    it('round-trips formatTag', () => {
      const parsed = parseTag('@IMP-MB-CORE-001@')
      expect(parsed).toEqual({ type: 'IMP', segments: ['MB', 'CORE'], number: 1 })
    })

    it('parses single-segment tags', () => {
      expect(parseTag('@REQ-SYS-013@')).toEqual({
        type: 'REQ',
        segments: ['SYS'],
        number: 13,
      })
    })

    it('round-trips hazard tags (no middle segments)', () => {
      // Regression for m1: previously the regex required ≥2 hyphens so
      // `@H-006@` (which has none between prefix and number) threw.
      expect(parseTag('@H-006@')).toEqual({ type: 'H', segments: [], number: 6 })
    })

    it('rejects malformed tags', () => {
      expect(() => parseTag('IMP-MB-CORE-001')).toThrow(/Malformed/)
      expect(() => parseTag('@IMP-MB@')).toThrow(/Malformed/)
    })
  })

  describe('parseAnnotations', () => {
    it('extracts FROM references', () => {
      const { fromTags, technical } = parseAnnotations(
        '// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@, @REQ-MB-002@, @DES-ARCH-001@)',
      )
      expect(fromTags).toEqual(['@REQ-MB-001@', '@REQ-MB-002@', '@DES-ARCH-001@'])
      expect(technical).toBe(false)
    })

    it('detects TECHNICAL marker', () => {
      const { fromTags, technical } = parseAnnotations('# @E2E-D-001@ (TECHNICAL)')
      expect(fromTags).toEqual([])
      expect(technical).toBe(true)
    })

    it('returns empty when neither marker is present', () => {
      expect(parseAnnotations('// no tag here')).toEqual({ fromTags: [], technical: false })
    })
  })

  describe('buildComment', () => {
    it('wraps a tag in Markdown comment syntax', () => {
      expect(buildComment({ tag: '@REQ-MB-001@', style: 'md' })).toBe('<!-- @REQ-MB-001@ -->')
    })

    it('wraps a tag in TypeScript // syntax with FROM clause', () => {
      expect(
        buildComment({
          tag: '@IMP-MB-CORE-001@',
          fromTags: ['@REQ-MB-001@'],
          style: 'ts',
        }),
      ).toBe('// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@)')
    })

    it('wraps a technical E2E tag in Gherkin # syntax', () => {
      expect(
        buildComment({ tag: '@E2E-D-001@', technical: true, style: 'feature' }),
      ).toBe('# @E2E-D-001@ (TECHNICAL)')
    })

    it('rejects mixing TECHNICAL with FROM tags', () => {
      expect(() =>
        buildComment({
          tag: '@E2E-D-001@',
          fromTags: ['@UJ-D-001@'],
          technical: true,
          style: 'feature',
        }),
      ).toThrow(/TECHNICAL/)
    })
  })

  describe('commentStyleFor', () => {
    it('picks the right comment style from file extension', () => {
      expect(commentStyleFor('docs/journeys/some.md')).toBe('md')
      expect(commentStyleFor('frontend/src/x.ts')).toBe('ts')
      expect(commentStyleFor('frontend/tests/e2e/foo.feature')).toBe('feature')
    })
  })
})
