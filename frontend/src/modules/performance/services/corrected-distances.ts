import type { Operation, RunwayFacts, SourceAssessment } from '@/core/logic/performance.correction-sources'
import { safetyMargin } from '@/core/logic/performance.safety-factor'
import { applyTecnamS9Corrections, TECNAM_S9_SOURCE_IDS, type S9NotCredited } from '@/core/logic/performance.tecnam-s9-corrections'
import { OPERATION_LABELS } from './correction-source-messages'
import { formatNumber } from './performance-presentation'
import { parseLookupNumber, type GroupAssessment } from './poh-inspection'

/** Pilot-entered conditions for one operation; raw text so an empty field is never zero. */
export type CorrectionConditions = { headwind: string; slope: string }
export type CorrectionInputs = Record<Operation, CorrectionConditions>
export const emptyCorrectionInputs = (): CorrectionInputs => ({
  takeoff: { headwind: '', slope: '' }, landing: { headwind: '', slope: '' },
})

export type CorrectedOperationPresentation =
  | {
    readonly operation: Operation
    readonly title: string
    readonly status: 'applied'
    /** Document, revision and section of the rule set that supplied every correction. */
    readonly source: string
    readonly rows: readonly { readonly label: string; readonly raw: string; readonly corrected: string; readonly factored: string }[]
    readonly notes: readonly string[]
    /** Final distance over 50 ft against the declared runway length; never a go/no-go decision. */
    readonly comparison: RunwayComparison
  }
  | { readonly operation: Operation; readonly title: string; readonly status: 'unavailable'; readonly reason: string }

export type RunwayComparison = {
  readonly status: 'sufficient' | 'insufficient'
  readonly availableLabel: string
  readonly required: string
  readonly available: string
  readonly margin: string
  readonly summary: string
}

/** Declared available distances in metres, already rounded down so a margin is never overstated. */
export type AvailableDistancesM = { readonly tora: number; readonly lda: number }

const NOT_CREDITED: Record<S9NotCredited, string> = {
  headwind: 'Headwind is not credited: the manual states no range for it.',
  'favourable-slope': 'Favourable slope is not credited: the manual states no range for it.',
}
const SLOPE_LIMIT_PERCENT = 100

/**
 * Corrected distances for one operation from the accepted aircraft-manual rules.
 * Returns an explicit unavailable reason whenever the source, a pilot input or the raw
 * distance is missing; raw distances are never silently substituted.
 */
export function presentCorrectedOperation(
  operation: Operation,
  group: GroupAssessment | null,
  sources: SourceAssessment | null,
  runway: RunwayFacts | null,
  inputs: CorrectionConditions,
  available: AvailableDistancesM | null,
): CorrectedOperationPresentation {
  const title = OPERATION_LABELS[operation]
  const unavailable = (reason: string): CorrectedOperationPresentation => ({ operation, title, status: 'unavailable', reason })
  if (group?.status !== 'success') return unavailable('No raw POH distance for this operation, so nothing can be corrected.')
  if (sources?.status !== 'assessed') return unavailable('Correction sources cannot be assessed for this profile. Distances stay uncorrected.')
  const rows = sources.corrections.filter((row) => row.operation === operation)
  const selected = rows.map((row) => row.selected)
  const supplied = selected.every((candidate) => candidate && TECNAM_S9_SOURCE_IDS.includes(candidate.id))
  if (!supplied || !selected[0]) return unavailable('No accepted correction source covers wind, surface and slope for this aircraft and runway. Distances stay uncorrected; see Correction sources.')
  if (!runway) return unavailable('Save the manual runway to select its surface correction.')

  const headwindKt = parseLookupNumber(inputs.headwind)
  const slopePercent = parseLookupNumber(inputs.slope)
  if (headwindKt === null) return unavailable('Enter the headwind component in knots (negative for tailwind; 0 for calm).')
  if (slopePercent === null || Math.abs(slopePercent) >= SLOPE_LIMIT_PERCENT) return unavailable('Enter the runway slope in percent (positive uphill in the direction of use; 0 for level), between -100 and 100.')

  const [roll, over50] = group.distances
  if (!roll || !over50) return unavailable('Raw distance rows are incomplete.')
  const result = applyTecnamS9Corrections({
    operation, groundRoll: roll.distance, distanceOver50ft: over50.distance,
    surface: runway.surface.type === 'paved' ? 'paved' : 'grass', headwindKt, slopePercent,
  })
  const up = (value: number) => `${formatNumber(Math.ceil(value), 0)} m`
  const { document } = selected[0]
  const comparison = compareWithRunway(operation, Math.ceil(result.factoredDistanceOver50ft), available)
  return {
    operation, title, status: 'applied',
    source: `${document.title}, ${document.identifier}, ${document.revision}`,
    rows: [
      { label: roll.label, raw: `${formatNumber(roll.distance)} m`, corrected: up(result.groundRoll), factored: up(result.factoredGroundRoll) },
      { label: over50.label, raw: `${formatNumber(over50.distance)} m`, corrected: up(result.distanceOver50ft), factored: up(result.factoredDistanceOver50ft) },
    ],
    comparison,
    notes: [
      `Final value = corrected distance × ${result.inServiceFactor} (in-service factor stated by the manual), rounded up to whole metres.`,
      ...result.notCredited.map((item) => NOT_CREDITED[item]),
      ...(operation === 'landing' ? ['The manual landing table exists for 650 kg only; lower masses use it unchanged.'] : []),
      'Operator-supplied manual excerpt for D-EBPN, not manufacturer-confirmed. Not an operational approval or go/no-go decision.',
    ],
  }
}

/**
 * Compares the final distance over 50 ft with TORA (take-off) or LDA (landing). No TODA is
 * entered, so TORA is the conservative take-off bound. Equal distances are sufficient with zero margin.
 */
function compareWithRunway(operation: Operation, requiredM: number, available: AvailableDistancesM | null): RunwayComparison {
  const takeoff = operation === 'takeoff'
  const availableLabel = takeoff ? 'TORA' : 'LDA'
  const availableM = available ? (takeoff ? available.tora : available.lda) : null
  const required = `${formatNumber(requiredM, 0)} m`
  if (availableM === null || !Number.isFinite(availableM) || availableM <= 0) {
    return { status: 'insufficient', availableLabel, required, available: 'Not available', margin: 'Not available',
      summary: `Runway ${availableLabel} is not available, so the distance cannot be compared.` }
  }
  const { absolute, percent } = safetyMargin(availableM, requiredM)
  const sufficient = absolute >= 0
  const signed = `${absolute >= 0 ? '+' : '−'}${formatNumber(Math.abs(absolute), 1)} m`
  const pct = percent === null ? '' : ` (${percent >= 0 ? '+' : '−'}${formatNumber(Math.abs(percent), 1)} %)`
  return {
    status: sufficient ? 'sufficient' : 'insufficient', availableLabel, required,
    available: `${formatNumber(availableM, 1)} m`, margin: `${signed}${pct}`,
    summary: sufficient
      ? `Final distance over 50 ft fits the declared ${availableLabel}.`
      : `Runway insufficient: the final distance over 50 ft exceeds the declared ${availableLabel}.`,
  }
}
