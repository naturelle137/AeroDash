import { SURFACE_CONDITIONS, type SurfaceCondition } from '@/core/logic/manual-runway'
import type {
  AssessmentBlocker,
  CorrectionAssessment,
  CorrectionKind,
  CorrectionRequirement,
  Operation,
  UnsupportedReason,
} from '@/core/logic/performance.correction-sources'

/** Pilot-facing wording for the pure source assessment; no decision logic lives here. */

export const CORRECTION_LABELS: Record<CorrectionKind, string> = {
  wind: 'Wind', surface: 'Runway surface', slope: 'Runway slope',
}
export const OPERATION_LABELS: Record<Operation, string> = { takeoff: 'Takeoff', landing: 'Landing' }

const CONDITION_LABELS = Object.fromEntries(
  Object.values(SURFACE_CONDITIONS).flat().map((option) => [option.value, option.label]),
) as Record<SurfaceCondition, string>

export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition as SurfaceCondition] ?? condition
}

export const BLOCKER_MESSAGES: Record<AssessmentBlocker, string> = {
  'base-tables-missing': 'This profile lacks complete POH distance tables. No correction source can replace missing aircraft tables.',
  'profile-draft': 'This profile is a Draft. Review and verify it in Fleet before assessing correction sources.',
}

export const SUMMARY_MESSAGES: Record<CorrectionAssessment['summary'], string> = {
  'no-source': 'No source available.',
  'aircraft-candidate-not-applicable': 'Not available: a manual for this aircraft type was found, but it is not established as applicable.',
  'generic-candidate-not-applicable': 'Not available: only generic guidance was found, and it is not accepted for this use.',
  'source-identified': 'Source identified; no correction value is applied in this version.',
}

export function requirementMessage(required: CorrectionRequirement, correction: CorrectionKind): string {
  const target = required.target === 'ground-roll' ? 'acting on the ground roll' : 'acting on the whole distance'
  const condition = correction === 'surface'
    ? required.condition ? ` for ${conditionLabel(required.condition)}` : ' for the saved runway condition'
    : ''
  return `Needs your aircraft's applicable POH/AFM ${CORRECTION_LABELS[correction].toLowerCase()} correction${condition}, ${target}, as a single factor with its valid range.`
}

export const INPUT_GAP_MESSAGES: Record<NonNullable<CorrectionAssessment['inputGap']>, string> = {
  'wind-component': 'AeroDash does not collect a wind component yet.',
  'runway-slope': 'AeroDash does not collect a runway slope yet.',
}

const TARGET_LABELS = { 'ground-roll': 'ground roll', 'distance-over-obstacle': 'distance over an obstacle', unspecified: 'unspecified part' } as const

export function reasonMessage(reason: UnsupportedReason): string {
  switch (reason.code) {
    case 'configuration-unverified': return `Applicability to this aircraft is not established. Required evidence: ${reason.required}.`
    case 'revision-not-current': return `The inspected copy (${reason.revision}) is not confirmed as the current revision.`
    case 'authenticity-unconfirmed': return 'The inspected copy is not confirmed as an authentic, current publication.'
    case 'scope-not-accepted': return `Scope not accepted: ${reason.scope}.`
    case 'target-unresolved': return 'The source does not state whether the correction applies to the ground roll or the whole distance.'
    case 'range-undefined': return 'The source states no valid range for this correction.'
    case 'numeric-contract-unaccepted': return 'Its correction values have not been accepted for use in AeroDash.'
    case 'mass-configuration-mismatch': return `Written for ${reason.sourceMtomKg} kg; this profile's maximum mass is ${Number(reason.profileMtomKg.toFixed(1))} kg.`
    case 'profile-mass-unknown': return "The profile's maximum mass could not be read in kg, so the mass configuration cannot be matched."
    case 'operation-not-covered': return `It contains no ${OPERATION_LABELS[reason.operation].toLowerCase()} correction.`
    case 'condition-not-covered': return `It has no entry for ${conditionLabel(reason.condition)}; a missing entry is never treated as “no correction”.`
    case 'condition-mapping-ambiguous': return `${conditionLabel(reason.condition)} matches more than one source row; it cannot be chosen automatically.`
    case 'runway-condition-missing': return 'No saved, unchanged manual runway: the surface condition is unknown.'
    case 'baseline-conflict': return 'The aircraft manual’s distances are already for grass; a generic grass uplift would count grass twice.'
    case 'baseline-unknown': return 'The runway surface your POH distances assume is not recorded in the profile.'
    case 'target-mismatch': return `It corrects the ${TARGET_LABELS[reason.sourceTarget]}, but this correction must act on the ${TARGET_LABELS[reason.requiredTarget]} only.`
    case 'additive-contract-unsupported': return 'It adds metres per knot; that cannot be expressed as one factor shared by roll and distance.'
    case 'relative-contract-unsupported': return 'It depends on wind relative to lift-off speed, which AeroDash does not model.'
    case 'aircraft-source-precedence': return 'A manual for this aircraft type exists; generic guidance cannot replace it.'
  }
}
