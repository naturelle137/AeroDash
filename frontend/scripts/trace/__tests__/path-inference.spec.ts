import { describe, expect, it } from 'vitest'

import {
  assertCanonical,
  inferLayer,
  inferModule,
  inferPhase,
  inferSegments,
} from '../lib/path-inference.mjs'

describe('path-inference', () => {
  describe('inferModule', () => {
    it('detects module from typical src paths', () => {
      expect(inferModule('frontend/src/modules/mass-balance/views/MbView.vue')).toBe('MB')
      expect(inferModule('frontend/src/modules/aircraft/store.ts')).toBe('AC')
      expect(inferModule('frontend/src/modules/performance/x.ts')).toBe('PF')
      expect(inferModule('frontend/src/modules/fuel-endurance/y.ts')).toBe('FE')
    })

    it('returns undefined when no module token is in the path', () => {
      expect(inferModule('frontend/src/main.ts')).toBeUndefined()
    })

    // Regression for review m5 — AC's `'aircraft'` alias prefix-matched
    // `aircraft-data` before AD's exact `'aircraft-data'` alias was tried,
    // mis-routing tags to module AC. Exact match must win across all ids
    // before any prefix match is considered.
    it('prefers exact alias match over prefix match (AC vs AD on aircraft-data/)', () => {
      expect(inferModule('frontend/src/modules/aircraft-data/profile.ts')).toBe('AD')
      expect(inferModule('frontend/src/modules/detailed-aircraft/profile.ts')).toBe('AD')
      // Sanity: actual AC still resolves
      expect(inferModule('frontend/src/modules/aircraft/Foo.vue')).toBe('AC')
    })
  })

  describe('inferLayer', () => {
    it('detects layer from canonical folder names', () => {
      expect(inferLayer('frontend/src/core/logic/mb.ts')).toBe('CORE')
      expect(inferLayer('frontend/src/stores/foo.ts')).toBe('STORE')
      expect(inferLayer('frontend/src/plugins/bar.ts')).toBe('PLUGIN')
      expect(inferLayer('frontend/src/shared/baz.ts')).toBe('SHARED')
      expect(inferLayer('frontend/src/router/index.ts')).toBe('ROUTE')
      expect(inferLayer('frontend/src/modules/mass-balance/views/X.vue')).toBe('VIEW')
    })
  })

  describe('inferPhase', () => {
    it('detects phase from e2e feature paths', () => {
      expect(inferPhase('frontend/tests/e2e/features/phase-a-fleet-management/x.feature')).toBe('A')
      expect(inferPhase('frontend/tests/e2e/features/phase-d-system-pwa/x.feature')).toBe('D')
      expect(inferPhase('frontend/tests/e2e/features/stress/x.feature')).toBe('STRESS')
    })
  })

  describe('assertCanonical', () => {
    it('returns uppercase canonical value', () => {
      expect(assertCanonical('module', 'mb')).toBe('MB')
      expect(assertCanonical('layer', 'core')).toBe('CORE')
      expect(assertCanonical('phase', 'a')).toBe('A')
    })

    it('rejects unknown values', () => {
      expect(() => assertCanonical('module', 'XY')).toThrow(/Unknown module/)
      expect(() => assertCanonical('layer', 'magic')).toThrow(/Unknown layer/)
    })
  })

  describe('inferSegments', () => {
    it('builds [module, layer] for IMP', () => {
      expect(
        inferSegments('IMP', 'frontend/src/modules/mass-balance/views/X.vue'),
      ).toEqual(['MB', 'VIEW'])
    })

    it('builds [module] for REQ', () => {
      expect(inferSegments('REQ', 'docs/requirements/mass_balance.md')).toEqual(['MB'])
    })

    it('builds [phase] for UJ', () => {
      expect(inferSegments('UJ', 'docs/journeys/phase-a-fleet-management.md')).toEqual([
        'A',
      ])
    })

    it('throws when DES is requested without explicit subtype', () => {
      expect(() => inferSegments('DES', 'docs/architecture/x.md')).toThrow(/--subtype/)
    })

    it('throws when path lacks enough structure', () => {
      expect(() => inferSegments('IMP', 'frontend/src/main.ts')).toThrow(/Cannot infer/)
    })
  })
})
