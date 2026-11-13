import { describe, expect, it } from 'vitest'
import {
  CORRECTION_SOURCE_REGISTER,
  assessCorrectionSources,
  assessmentBasisKey,
  profileFacts,
  type CorrectionAssessment,
  type ProfileFacts,
  type RunwayFacts,
  type SourceAssessment,
  type SourceCandidate,
  type UnsupportedReason,
} from './performance.correction-sources'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'

// Synthetic profile facts; registrations and runways are fictional.
const facts = (patch: Partial<ProfileFacts> = {}): ProfileFacts => ({
  id: 'p', registration: 'D-TEST', icaoTypeDesignator: 'TEST', mtomKg: 1200,
  verified: true, baseTablesComplete: true, legacySurfaceFactors: 0, ...patch,
})
const runway = (type: RunwayFacts['surface']['type'], condition: RunwayFacts['surface']['condition']): RunwayFacts =>
  ({ label: 'TEST 09', surface: { type, condition } })

function assessed(result: SourceAssessment) {
  if (result.status !== 'assessed') throw new Error(`blocked: ${result.reason}`)
  return result
}
function item(result: SourceAssessment, correction: CorrectionAssessment['correction'], operation: CorrectionAssessment['operation']) {
  return assessed(result).corrections.find((entry) => entry.correction === correction && entry.operation === operation)!
}
function reasonsOf(entry: CorrectionAssessment, candidateId: string): UnsupportedReason[] {
  return entry.candidates.find((candidate) => candidate.candidate.id === candidateId)!.reasons
}
const codes = (reasons: UnsupportedReason[]) => reasons.map((reason) => reason.code)

describe('built-in source register', () => {
  it('holds no numeric correction value and no entry free of evidence gaps', () => {
    for (const candidate of CORRECTION_SOURCE_REGISTER) {
      expect(candidate.evidenceGaps.length).toBeGreaterThan(0)
      expect(Object.keys(candidate)).not.toEqual(expect.arrayContaining(['factor']))
    }
  })

  it('selects nothing for any profile, runway condition or operation', () => {
    for (const icaoTypeDesignator of ['P208', 'C172', 'TEST']) {
      for (const mtomKg of [630, 650, 1200, null]) {
        for (const surface of [runway('paved', 'dry'), runway('unpaved', 'dry-short-grass'), runway('paved', 'wet'), null]) {
          const result = assessed(assessCorrectionSources(facts({ icaoTypeDesignator, mtomKg }), surface))
          expect(result.corrections).toHaveLength(6)
          expect(result.corrections.every((entry) => entry.status === 'unsupported' && entry.selected === null)).toBe(true)
        }
      }
    }
  })
})

describe('assessCorrectionSources', () => {
  it('never supplies a correction source in place of missing POH base tables', () => {
    expect(assessCorrectionSources(facts({ baseTablesComplete: false, icaoTypeDesignator: 'P208', mtomKg: 650 }), runway('paved', 'dry')))
      .toMatchObject({ status: 'blocked', reason: 'base-tables-missing' })
  })

  it('blocks Draft profiles before any source assessment', () => {
    expect(assessCorrectionSources(facts({ verified: false }), null)).toMatchObject({ status: 'blocked', reason: 'profile-draft' })
  })

  it('offers only generic guidance, with its scope gaps, for a type without an inspected manual', () => {
    const result = assessCorrectionSources(facts(), runway('paved', 'dry'))
    const wind = item(result, 'wind', 'takeoff')
    expect(wind.summary).toBe('generic-candidate-not-applicable')
    expect(wind.candidates.map((candidate) => candidate.candidate.document.kind)).toEqual(['generic-guidance'])
    expect(codes(reasonsOf(wind, 'caa-wind'))).toEqual(expect.arrayContaining(['scope-not-accepted', 'relative-contract-unsupported', 'condition-not-covered']))
    expect(wind.inputGap).toBe('wind-component')
    expect(item(result, 'slope', 'landing').inputGap).toBe('runway-slope')
  })

  it('identifies a type-designator candidate without treating the match as configuration evidence', () => {
    const entry = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'p208 ', mtomKg: 650 }), runway('paved', 'dry')), 'surface', 'takeoff')
    expect(entry.summary).toBe('aircraft-candidate-not-applicable')
    expect(reasonsOf(entry, 'tecnam-s4-surface')).toEqual([
      { code: 'configuration-unverified', required: expect.stringContaining('Supplement S4') },
      { code: 'revision-not-current', revision: 'Edition 2, Revision 7 (30 July 2020)' },
      { code: 'numeric-contract-unaccepted' },
    ])
  })

  it('rejects the basic 630 kg chapter for a 650 kg profile and the reverse', () => {
    const heavy = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'P208', mtomKg: 650 }), null), 'slope', 'takeoff')
    expect(reasonsOf(heavy, 'tecnam-basic-slope')).toContainEqual({ code: 'mass-configuration-mismatch', profileMtomKg: 650, sourceMtomKg: 630 })
    expect(codes(reasonsOf(heavy, 'tecnam-s4-slope'))).not.toContain('mass-configuration-mismatch')
    const basic = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'P208', mtomKg: 630 }), null), 'slope', 'takeoff')
    expect(reasonsOf(basic, 'tecnam-s4-slope')).toContainEqual({ code: 'mass-configuration-mismatch', profileMtomKg: 630, sourceMtomKg: 650 })
    const unknown = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'P208', mtomKg: null }), null), 'slope', 'takeoff')
    expect(codes(reasonsOf(unknown, 'tecnam-s4-slope'))).toContain('profile-mass-unknown')
  })

  it('refuses a generic grass uplift on top of a manual whose base distances are already on grass', () => {
    const entry = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'P208', mtomKg: 650 }), runway('unpaved', 'dry-short-grass')), 'surface', 'takeoff')
    expect(reasonsOf(entry, 'caa-surface')).toEqual(expect.arrayContaining([
      { code: 'aircraft-source-precedence' }, { code: 'baseline-conflict', aircraftBaseline: 'grass' },
    ]))
    // The manual has no defined grass condition cell either; nothing fills that gap.
    expect(reasonsOf(entry, 'tecnam-s4-surface')).toContainEqual({ code: 'condition-not-covered', condition: 'dry-short-grass' })
    const generic = item(assessCorrectionSources(facts(), runway('unpaved', 'dry-short-grass')), 'surface', 'takeoff')
    expect(codes(reasonsOf(generic, 'caa-surface'))).toContain('baseline-unknown')
  })

  it('reports missing guidance cells and wrong operations instead of a unit factor', () => {
    const wetTakeoff = item(assessCorrectionSources(facts(), runway('paved', 'wet')), 'surface', 'takeoff')
    expect(reasonsOf(wetTakeoff, 'caa-surface')).toContainEqual({ code: 'condition-not-covered', condition: 'wet' })
    const wetLanding = item(assessCorrectionSources(facts(), runway('paved', 'wet')), 'surface', 'landing')
    expect(reasonsOf(wetLanding, 'caa-surface')).not.toContainEqual({ code: 'condition-not-covered', condition: 'wet' })
    expect(reasonsOf(wetLanding, 'fsm-surface')).toContainEqual({ code: 'operation-not-covered', operation: 'landing' })
    const slope = item(assessCorrectionSources(facts(), null), 'slope', 'landing')
    expect(reasonsOf(slope, 'caa-slope')).toContainEqual({ code: 'condition-not-covered', condition: 'uphill slope' })
    const soft = item(assessCorrectionSources(facts(), runway('unpaved', 'wet-soft-ground')), 'surface', 'landing')
    expect(reasonsOf(soft, 'caa-surface')).toContainEqual({ code: 'condition-mapping-ambiguous', condition: 'wet-soft-ground' })
  })

  it('keeps a full-distance source out of the ground-roll surface and slope corrections', () => {
    const entry = item(assessCorrectionSources(facts(), runway('unpaved', 'dry-short-grass')), 'surface', 'takeoff')
    expect(reasonsOf(entry, 'fsm-surface')).toContainEqual({ code: 'target-mismatch', sourceTarget: 'distance-over-obstacle', requiredTarget: 'ground-roll' })
  })

  it('needs the saved runway condition before a surface source can be matched', () => {
    const entry = item(assessCorrectionSources(facts(), null), 'surface', 'landing')
    expect(entry.required.condition).toBeUndefined()
    expect(entry.candidates.every((candidate) => codes(candidate.reasons).includes('runway-condition-missing'))).toBe(true)
  })

  it('flags stored legacy surface factors as ignored', () => {
    expect(assessed(assessCorrectionSources(facts({ legacySurfaceFactors: 2 }), null)).legacyFactorsIgnored).toBe(true)
  })
})

describe('additive wind versus a shared multiplier (inspected reference arithmetic only)', () => {
  // Transcribed from Tecnam P2008 JC AFM Ed. 2 Rev. 7, Supplement S4 p. 5W-7, 650 kg, SL, 25 °C:
  // TOR 264 m, TOD 436 m, tailwind +15 m/kt. Checks contract shape, not operational distances.
  const tor = 264
  const tod = 436
  const delta = 3 * 15

  it('cannot be represented by one multiplier for both distances', () => {
    expect(delta).toBe(45)
    const torRatio = (tor + delta) / tor
    const todRatio = (tod + delta) / tod
    expect(torRatio).toBeCloseTo(1.1705, 4)
    expect(todRatio).toBeCloseTo(1.1032, 4)
    expect(torRatio).not.toBeCloseTo(todRatio, 2)
  })

  it('is therefore rejected as an unsupported contract', () => {
    const entry = item(assessCorrectionSources(facts({ icaoTypeDesignator: 'P208', mtomKg: 650 }), null), 'wind', 'takeoff')
    expect(codes(reasonsOf(entry, 'tecnam-s4-wind'))).toEqual(expect.arrayContaining(['additive-contract-unsupported', 'target-unresolved', 'range-undefined']))
  })

  it('reproduces isolated roll corrections without stacking them', () => {
    // S4 5W-7 / 5W-15: paved −10 % and +1 % uphill +7 % (TOR), −3 % (LR); separate alternatives.
    expect(Number((tor * 0.9).toFixed(2))).toBe(237.6)
    expect(Number((tor * 1.07).toFixed(2))).toBe(282.48)
    expect(Number((179 * 0.9).toFixed(2))).toBe(161.1)
    expect(Number((179 * 0.97).toFixed(2))).toBe(173.63)
  })
})

describe('resolver wiring with a synthetic complete source', () => {
  // Fictional entry: proves that complete evidence would be selectable, never a real source.
  const synthetic: SourceCandidate = {
    id: 'synthetic-slope', correction: 'slope', operations: ['takeoff', 'landing'], target: 'ground-roll',
    contract: 'multiplier', baseline: 'unspecified', evidenceGaps: [],
    aircraft: { icaoTypeDesignator: 'TEST', mtomKg: 1200, configuration: 'Synthetic Test wiring only' },
    section: 'Synthetic', document: { id: 'synthetic', title: 'Synthetic Test document', identifier: 'T', revision: 'T', kind: 'aircraft-manual', origin: 'Test fixture' },
  }

  it('selects only a gap-free candidate and still demands the slope input', () => {
    const entry = item(assessCorrectionSources(facts(), null, [synthetic, ...CORRECTION_SOURCE_REGISTER]), 'slope', 'takeoff')
    expect(entry).toMatchObject({ status: 'source-identified', selected: { id: 'synthetic-slope' }, inputGap: 'runway-slope' })
    expect(reasonsOf(entry, 'caa-slope')).toContainEqual({ code: 'aircraft-source-precedence' })
  })

  it('does not select it for another mass configuration', () => {
    const entry = item(assessCorrectionSources(facts({ mtomKg: 1100 }), null, [synthetic]), 'slope', 'takeoff')
    expect(entry.status).toBe('unsupported')
  })
})

describe('profile facts and basis key', () => {
  it('derive normalized identity, kg mass and legacy factor count from a stored profile', () => {
    const profile = { ...testPohAircraft(), surfaceConditions: [{ name: 'Grass', takeoffFactor: 1.2, landingFactor: 1.2 }] }
    expect(profileFacts(profile, true)).toEqual({
      id: profile.id, registration: 'D-TEST', icaoTypeDesignator: 'TEST', mtomKg: 1200,
      verified: true, baseTablesComplete: true, legacySurfaceFactors: 1,
    })
    expect(profileFacts({ ...profile, sourceUnit: 'lb' }, true).mtomKg).toBeCloseTo(544.31, 2)
    expect(profileFacts({ ...profile, sourceUnit: 'stone' }, true).mtomKg).toBeNull()
  })

  it('changes whenever the profile snapshot, runway or lookup inputs change', () => {
    const profile = testPohAircraft()
    const key = assessmentBasisKey(profile, runway('paved', 'dry'), { mass: '900' })
    expect(assessmentBasisKey(profile, runway('paved', 'dry'), { mass: '900' })).toBe(key)
    expect(assessmentBasisKey({ ...profile, registration: 'D-TESU' }, runway('paved', 'dry'), { mass: '900' })).not.toBe(key)
    expect(assessmentBasisKey(profile, runway('paved', 'wet'), { mass: '900' })).not.toBe(key)
    expect(assessmentBasisKey(profile, null, { mass: '900' })).not.toBe(key)
    expect(assessmentBasisKey(profile, runway('paved', 'dry'), { mass: '901' })).not.toBe(key)
  })
})
