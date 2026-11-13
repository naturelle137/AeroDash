import type { AircraftProfile } from '../adapters/aircraft.schema'
import type { SurfaceCondition, SurfaceType } from './manual-runway'
import { LB_TO_KG } from './unit-conversion-constants'

/**
 * Environmental correction source selection and applicability.
 *
 * Pure assessment of WHICH source would have to supply a wind, surface or slope
 * correction and WHY no inspected source is applicable yet. It never returns a
 * factor or a corrected distance: the register carries document identity and
 * contract shape only, no numeric coefficients. A candidate is selectable only
 * when it has no applicability gap; no built-in entry meets that bar.
 *
 * @see docs/architecture/performance-correction-sources.md
 */

export const CORRECTION_KINDS = ['wind', 'surface', 'slope'] as const
export type CorrectionKind = (typeof CORRECTION_KINDS)[number]
export const OPERATIONS = ['takeoff', 'landing'] as const
export type Operation = (typeof OPERATIONS)[number]

/** Which part of a distance a source correction acts on. */
export type CorrectionTarget = 'ground-roll' | 'distance-over-obstacle' | 'unspecified'
/** How a source states its correction; only a dimensionless multiplier fits the current pipeline. */
export type CorrectionContract = 'multiplier' | 'additive-per-knot' | 'relative-to-lift-off-speed'
/** Runway surface on which the source's base distances were established. */
export type SourceBaseline = 'grass' | 'unspecified'

export type SourceDocument = {
  id: string
  title: string
  identifier: string
  revision: string
  kind: 'aircraft-manual' | 'generic-guidance'
  /** How the inspected copy was obtained; never implies currency or authenticity. */
  origin: string
}

export type AircraftApplicability = {
  icaoTypeDesignator: string
  /** Maximum take-off mass the section is written for. */
  mtomKg: number
  /** Configuration evidence a stored profile would need before this section may be used. */
  configuration: string
}

export type SourceCandidate = {
  id: string
  document: SourceDocument
  section: string
  correction: CorrectionKind
  operations: readonly Operation[]
  target: CorrectionTarget
  contract: CorrectionContract
  baseline: SourceBaseline
  /** Aircraft-specific scope; absent for generic guidance. */
  aircraft?: AircraftApplicability
  /** Runway conditions with a source cell, per operation (surface corrections only). */
  conditions?: Partial<Record<Operation, readonly SurfaceCondition[]>>
  /** Surface conditions without exactly one corresponding source row. */
  ambiguousConditions?: readonly SurfaceCondition[]
  /** Source cells limited to part of the input domain, e.g. tailwind only. */
  coverageLimits?: Partial<Record<Operation, readonly string[]>>
  /** Unresolved evidence gaps recorded at source acceptance. */
  evidenceGaps: readonly EvidenceGap[]
}

export type EvidenceGap =
  | { code: 'configuration-unverified'; required: string }
  | { code: 'revision-not-current'; revision: string }
  | { code: 'authenticity-unconfirmed' }
  | { code: 'scope-not-accepted'; scope: string }
  | { code: 'target-unresolved' }
  | { code: 'range-undefined' }
  | { code: 'numeric-contract-unaccepted' }

/** Discriminated reasons why one candidate cannot supply one correction. */
export type UnsupportedReason =
  | EvidenceGap
  | { code: 'mass-configuration-mismatch'; profileMtomKg: number; sourceMtomKg: number }
  | { code: 'profile-mass-unknown' }
  | { code: 'operation-not-covered'; operation: Operation }
  | { code: 'condition-not-covered'; condition: string }
  | { code: 'condition-mapping-ambiguous'; condition: SurfaceCondition }
  | { code: 'runway-condition-missing' }
  | { code: 'baseline-conflict'; aircraftBaseline: SourceBaseline }
  | { code: 'baseline-unknown' }
  | { code: 'target-mismatch'; sourceTarget: CorrectionTarget; requiredTarget: CorrectionTarget }
  | { code: 'additive-contract-unsupported' }
  | { code: 'relative-contract-unsupported' }
  | { code: 'aircraft-source-precedence' }

export type CandidateAssessment = { candidate: SourceCandidate; reasons: UnsupportedReason[] }

/** What the current pipeline would need from a source for one correction. */
export type CorrectionRequirement = {
  preferred: 'aircraft-manual'
  target: CorrectionTarget | 'whole-distance'
  contract: 'multiplier'
  condition?: SurfaceCondition
}

export type CorrectionAssessment = {
  correction: CorrectionKind
  operation: Operation
  required: CorrectionRequirement
  /** Pilot input this correction would need that AeroDash does not collect yet. */
  inputGap: 'wind-component' | 'runway-slope' | null
  candidates: CandidateAssessment[]
} & (
  | { status: 'unsupported'; selected: null; summary: 'no-source' | 'aircraft-candidate-not-applicable' | 'generic-candidate-not-applicable' }
  | { status: 'source-identified'; selected: SourceCandidate; summary: 'source-identified' }
)

export type ProfileFacts = {
  id: string
  registration: string
  icaoTypeDesignator: string
  mtomKg: number | null
  verified: boolean
  baseTablesComplete: boolean
  /** Count of stored legacy surface factors; never accepted as correction provenance. */
  legacySurfaceFactors: number
}

export type RunwayFacts = {
  label: string
  surface: { type: SurfaceType; condition: SurfaceCondition }
}

export type AssessmentBlocker = 'profile-draft' | 'base-tables-missing'

export type SourceAssessment =
  | { status: 'blocked'; reason: AssessmentBlocker; profile: ProfileFacts }
  | {
    status: 'assessed'
    profile: ProfileFacts
    runway: RunwayFacts | null
    corrections: CorrectionAssessment[]
    legacyFactorsIgnored: boolean
  }

/** Surface and slope act on ground roll only; wind acts on the whole distance. */
const REQUIRED_TARGET: Record<CorrectionKind, CorrectionRequirement['target']> = {
  wind: 'whole-distance', surface: 'ground-roll', slope: 'ground-roll',
}
const INPUT_GAP: Record<CorrectionKind, CorrectionAssessment['inputGap']> = {
  wind: 'wind-component', surface: null, slope: 'runway-slope',
}

/**
 * Highest certificated mass in kg. Only kg/lb profile units are understood;
 * anything else is unknown rather than guessed.
 */
function profileMtomKg(profile: AircraftProfile): number | null {
  const masses = profile.certificationCategories.map((category) => category.mtom)
  if (!masses.length) return null
  const max = Math.max(...masses)
  if (profile.sourceUnit === 'kg') return max
  if (profile.sourceUnit === 'lb' || profile.sourceUnit === 'lbs') return max * LB_TO_KG
  return null
}

export function profileFacts(profile: AircraftProfile, baseTablesComplete: boolean): ProfileFacts {
  return {
    id: profile.id,
    registration: profile.registration,
    icaoTypeDesignator: profile.icaoTypeDesignator.trim().toUpperCase(),
    mtomKg: profileMtomKg(profile),
    verified: profile.status === 'verified',
    baseTablesComplete,
    legacySurfaceFactors: profile.surfaceConditions?.length ?? 0,
  }
}

// Mass equality is a configuration discriminator, not a numeric tolerance band.
const MASS_MATCH_KG = 0.5

function assessCandidate(
  candidate: SourceCandidate,
  correction: CorrectionKind,
  operation: Operation,
  profile: ProfileFacts,
  runway: RunwayFacts | null,
  context: { aircraftCandidateExists: boolean; aircraftBaseline: SourceBaseline | null },
): UnsupportedReason[] {
  const reasons: UnsupportedReason[] = []
  if (candidate.aircraft) {
    if (profile.mtomKg === null) reasons.push({ code: 'profile-mass-unknown' })
    else if (Math.abs(profile.mtomKg - candidate.aircraft.mtomKg) > MASS_MATCH_KG) {
      reasons.push({ code: 'mass-configuration-mismatch', profileMtomKg: profile.mtomKg, sourceMtomKg: candidate.aircraft.mtomKg })
    }
  } else if (context.aircraftCandidateExists) {
    reasons.push({ code: 'aircraft-source-precedence' })
  }
  if (!candidate.operations.includes(operation)) reasons.push({ code: 'operation-not-covered', operation })
  for (const limit of candidate.coverageLimits?.[operation] ?? []) reasons.push({ code: 'condition-not-covered', condition: limit })

  if (correction === 'surface') {
    if (!runway) reasons.push({ code: 'runway-condition-missing' })
    else {
      const { condition } = runway.surface
      if (candidate.ambiguousConditions?.includes(condition)) reasons.push({ code: 'condition-mapping-ambiguous', condition })
      else if (!(candidate.conditions?.[operation] ?? []).includes(condition)) reasons.push({ code: 'condition-not-covered', condition })
    }
    // A generic uplift assumes a paved-dry baseline; adding it onto a grass baseline counts grass twice.
    if (!candidate.aircraft) {
      if (context.aircraftBaseline === 'grass') reasons.push({ code: 'baseline-conflict', aircraftBaseline: 'grass' })
      else reasons.push({ code: 'baseline-unknown' })
    }
  }

  const required = REQUIRED_TARGET[correction]
  if (candidate.contract === 'additive-per-knot') reasons.push({ code: 'additive-contract-unsupported' })
  else if (candidate.contract === 'relative-to-lift-off-speed') reasons.push({ code: 'relative-contract-unsupported' })
  if (required === 'ground-roll' && candidate.target !== 'ground-roll' && candidate.target !== 'unspecified') {
    reasons.push({ code: 'target-mismatch', sourceTarget: candidate.target, requiredTarget: 'ground-roll' })
  }
  reasons.push(...candidate.evidenceGaps)
  return reasons
}

/**
 * Assess every wind/surface/slope correction for takeoff and landing.
 * The register is injectable so resolver behaviour can be proven with
 * synthetic entries; the default register contains no accepted source.
 */
export function assessCorrectionSources(
  profile: ProfileFacts,
  runway: RunwayFacts | null,
  register: readonly SourceCandidate[] = CORRECTION_SOURCE_REGISTER,
): SourceAssessment {
  if (!profile.baseTablesComplete) return { status: 'blocked', reason: 'base-tables-missing', profile }
  if (!profile.verified) return { status: 'blocked', reason: 'profile-draft', profile }

  const designator = profile.icaoTypeDesignator.trim().toUpperCase()
  // A designator match only surfaces a candidate; configuration evidence remains a gap.
  const forAircraft = (candidate: SourceCandidate) =>
    !candidate.aircraft || candidate.aircraft.icaoTypeDesignator === designator
  const relevant = register.filter(forAircraft)
  const aircraftSurface = relevant.find((candidate) => candidate.aircraft && candidate.correction === 'surface')

  const corrections = CORRECTION_KINDS.flatMap((correction) => OPERATIONS.map((operation): CorrectionAssessment => {
    const pool = relevant.filter((candidate) => candidate.correction === correction)
    const aircraftCandidateExists = pool.some((candidate) => candidate.aircraft && candidate.operations.includes(operation))
    const candidates = pool.map((candidate) => ({
      candidate,
      reasons: assessCandidate(candidate, correction, operation, profile, runway, {
        aircraftCandidateExists,
        aircraftBaseline: aircraftSurface?.baseline ?? null,
      }),
    }))
    const required: CorrectionRequirement = {
      preferred: 'aircraft-manual',
      target: REQUIRED_TARGET[correction],
      contract: 'multiplier',
      ...(correction === 'surface' && runway ? { condition: runway.surface.condition } : {}),
    }
    const base = { correction, operation, required, inputGap: INPUT_GAP[correction], candidates }
    const usable = candidates.filter((item) => item.reasons.length === 0)
    const selected = usable.find((item) => item.candidate.aircraft) ?? usable[0]
    if (selected) return { ...base, status: 'source-identified', selected: selected.candidate, summary: 'source-identified' }
    const summary = !candidates.length
      ? 'no-source'
      : candidates.some((item) => item.candidate.aircraft) ? 'aircraft-candidate-not-applicable' : 'generic-candidate-not-applicable'
    return { ...base, status: 'unsupported', selected: null, summary }
  }))

  return { status: 'assessed', profile, runway, corrections, legacyFactorsIgnored: profile.legacySurfaceFactors > 0 }
}

/** Stable identity of an assessment's inputs; any difference makes a displayed assessment stale. */
export function assessmentBasisKey(profile: AircraftProfile | undefined, runway: RunwayFacts | null, extra: unknown = null): string {
  return JSON.stringify([profile ?? null, runway, extra])
}

// ---------------------------------------------------------------------------
// Inspected source register. Identity, section and contract shape only; it holds
// no correction values and no entry is accepted for operational use.
// ---------------------------------------------------------------------------

const TECNAM_AFM: SourceDocument = {
  id: 'tecnam-p2008jc-afm-2008-100',
  title: 'Tecnam P2008 JC Aircraft Flight Manual',
  identifier: 'Doc. 2008/100',
  revision: 'Edition 2, Revision 7 (30 July 2020)',
  kind: 'aircraft-manual',
  origin: 'Manufacturer-authored manual obtained from a third-party mirror; no manufacturer-controlled current copy.',
}
const FSM_3_75: SourceDocument = {
  id: 'lba-fsm-3-75',
  title: 'LBA Flugsicherheitsmitteilung FSM 3/75 (take-off distance)',
  identifier: 'FSM 3/75',
  revision: '1 July 1975 (1995 reprint)',
  kind: 'generic-guidance',
  origin: 'Historical German advisory publication obtained from a third-party mirror; no official archive copy located.',
}
const CAA_SSL_09: SourceDocument = {
  id: 'uk-caa-ssl-09',
  title: 'UK CAA Safety Sense Leaflet 09: Weight, Balance and Performance',
  identifier: 'Safety Sense 09',
  revision: 'August 2024',
  kind: 'generic-guidance',
  origin: 'Regulator-hosted UK general-aviation guidance.',
}

const TECNAM_BASIC_CONFIGURATION = 'P2008 JC (not NG) basic 630 kg aircraft: Rotax 912 S2 engine, GT-2/173/VRR-FW101 SRTC propeller, no Section 5 supplement in force, and the airframe serial number'
const TECNAM_S4_CONFIGURATION = 'P2008 JC (not NG) with the 650 kg modification and Supplement S4 in force, its engine/propeller supplements, and the airframe serial number'
const TECNAM_GAPS = (required: string): EvidenceGap[] => [
  { code: 'configuration-unverified', required },
  { code: 'revision-not-current', revision: TECNAM_AFM.revision },
  { code: 'numeric-contract-unaccepted' },
]

function tecnamEntries(variant: 'basic' | 's4'): SourceCandidate[] {
  const aircraft: AircraftApplicability = variant === 'basic'
    ? { icaoTypeDesignator: 'P208', mtomKg: 630, configuration: TECNAM_BASIC_CONFIGURATION }
    : { icaoTypeDesignator: 'P208', mtomKg: 650, configuration: TECNAM_S4_CONFIGURATION }
  const section = variant === 'basic'
    ? 'Section 5 (basic 630 kg), performance pages 5-7 to 5-14'
    : 'Supplement S4 (650 kg), take-off p. 5W-7 and landing p. 5W-15'
  const common = { document: TECNAM_AFM, section, operations: OPERATIONS, baseline: 'grass' as const, aircraft }
  const gaps = TECNAM_GAPS(aircraft.configuration)
  return [
    { ...common, id: `tecnam-${variant}-wind`, correction: 'wind', target: 'unspecified', contract: 'additive-per-knot', evidenceGaps: [...gaps, { code: 'target-unresolved' }, { code: 'range-undefined' }] },
    // Base tables are for grass; the paved correction acts on ground roll. Grass and wet conditions have no cell.
    { ...common, id: `tecnam-${variant}-surface`, correction: 'surface', target: 'ground-roll', contract: 'multiplier', conditions: { takeoff: ['dry'], landing: ['dry'] }, evidenceGaps: gaps },
    { ...common, id: `tecnam-${variant}-slope`, correction: 'slope', target: 'ground-roll', contract: 'multiplier', evidenceGaps: [...gaps, { code: 'range-undefined' }] },
  ]
}

const FSM_GAPS: EvidenceGap[] = [{ code: 'authenticity-unconfirmed' }, { code: 'numeric-contract-unaccepted' }]
const CAA_GAPS: EvidenceGap[] = [{ code: 'scope-not-accepted', scope: 'UK general-aviation guidance' }, { code: 'numeric-contract-unaccepted' }]

export const CORRECTION_SOURCE_REGISTER: readonly SourceCandidate[] = Object.freeze([
  ...tecnamEntries('basic'),
  ...tecnamEntries('s4'),
  {
    id: 'fsm-surface', document: FSM_3_75, section: 'Table C.5 (surface), definitions A.4', correction: 'surface',
    operations: ['takeoff'], target: 'distance-over-obstacle', contract: 'multiplier', baseline: 'unspecified',
    conditions: { takeoff: ['dry-short-grass'] }, evidenceGaps: FSM_GAPS,
  },
  {
    id: 'fsm-slope', document: FSM_3_75, section: 'Table C.4 (slope)', correction: 'slope',
    operations: ['takeoff'], target: 'distance-over-obstacle', contract: 'multiplier', baseline: 'unspecified',
    evidenceGaps: [...FSM_GAPS, { code: 'range-undefined' }],
  },
  {
    id: 'caa-wind', document: CAA_SSL_09, section: 'Page 13, take-off and landing distance factors (tailwind row)', correction: 'wind',
    operations: OPERATIONS, target: 'distance-over-obstacle', contract: 'relative-to-lift-off-speed', baseline: 'unspecified',
    coverageLimits: { takeoff: ['headwind'], landing: ['headwind'] }, evidenceGaps: CAA_GAPS,
  },
  {
    id: 'caa-surface', document: CAA_SSL_09, section: 'Page 15, surface factors', correction: 'surface',
    operations: OPERATIONS, target: 'distance-over-obstacle', contract: 'multiplier', baseline: 'unspecified',
    conditions: { takeoff: ['dry-short-grass', 'long-grass'], landing: ['dry-short-grass', 'long-grass', 'wet'] },
    // Separate wet-grass and soft-ground rows; one AeroDash category cannot pick between them.
    ambiguousConditions: ['wet-soft-ground'],
    evidenceGaps: CAA_GAPS,
  },
  {
    id: 'caa-slope', document: CAA_SSL_09, section: 'Page 13, take-off and landing distance factors (slope rows)', correction: 'slope',
    operations: OPERATIONS, target: 'distance-over-obstacle', contract: 'multiplier', baseline: 'unspecified',
    coverageLimits: { takeoff: ['downhill slope'], landing: ['uphill slope'] }, evidenceGaps: [...CAA_GAPS, { code: 'range-undefined' }],
  },
] satisfies SourceCandidate[])
