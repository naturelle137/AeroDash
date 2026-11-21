import type { Operation, RunwayFacts, SourceAssessment } from '@/core/logic/performance.correction-sources'
import { isOsfBelowMinimum, osfThreshold, OSF_MAX, OSF_MIN, resolveOsf, safetyMargin } from '@/core/logic/performance.safety-factor'
import type { OperationalSafetyFactorInput, OsfPreset } from '@/core/domain/performance.math-types'
import { applyTecnamS9Corrections, TECNAM_S9_RULES, TECNAM_S9_SOURCE_IDS, type S9NotCredited } from '@/core/logic/performance.tecnam-s9-corrections'
import { estimateFsmTakeoff, type FsmNotCredited } from '@/core/logic/performance.fsm-estimates'
import { OPERATION_LABELS } from './correction-source-messages'
import { formatNumber } from './performance-presentation'
import { parseLookupNumber, type GroupAssessment } from './poh-inspection'

/** Pilot-entered conditions for one operation; raw text so an empty field is never zero. */
export type CorrectionConditions = { headwind: string; slope: string }
export type CorrectionInputs = Record<Operation, CorrectionConditions>
export const emptyCorrectionInputs = (): CorrectionInputs => ({
  takeoff: { headwind: '', slope: '' }, landing: { headwind: '', slope: '' },
})

/** Pilot-selected safety factor for one operation; `poh-afm` is the factor stated by the accepted manual. */
export type SafetyFactorSelection = { preset: OsfPreset; custom: string }
export type SafetyFactorSelections = Record<Operation, SafetyFactorSelection>
export const defaultSafetyFactors = (): SafetyFactorSelections => ({
  takeoff: { preset: 'poh-afm', custom: '' }, landing: { preset: 'poh-afm', custom: '' },
})
export const SAFETY_FACTOR_PRESETS: readonly { value: OsfPreset; label: string }[] = [
  { value: 'poh-afm', label: 'Manual (in-service factor)' },
  { value: 'easa-standard', label: 'EASA standard (1.25 take-off, 1.43 landing)' },
  { value: 'short-field', label: 'Short field (1.25 take-off, 1.15 landing)' },
  { value: 'custom', label: 'Custom (1.00–3.00)' },
]

export type CorrectedOperationPresentation =
  | {
    readonly operation: Operation
    readonly title: string
    readonly status: 'applied'
    /** Document, revision and section of the rule set that supplied every correction. */
    readonly source: string
    readonly partial: boolean
    readonly rows: readonly { readonly label: string; readonly raw: string; readonly corrected: string; readonly factored: string }[]
    readonly notes: readonly string[]
    /** Applied safety factor with its origin, shown beside the final values. */
    readonly safetyFactor: string
    /** WARN-PF-002 text when the selected factor is below the recommended minimum; advisory only. */
    readonly safetyFactorWarning: string | null
    /** Final distance over 50 ft against the declared runway length; never a go/no-go decision. */
    readonly comparison: RunwayComparison
  }
  | { readonly operation: Operation; readonly title: string; readonly status: 'unavailable'; readonly reason: string }

export type RunwayComparison = {
  readonly status: 'sufficient' | 'insufficient' | 'unavailable'
  readonly availableLabel: string
  readonly required: string
  readonly available: string
  readonly margin: string
  readonly summary: string
}

/** Declared available distances in metres, already rounded down so a margin is never overstated. */
export type AvailableDistancesM = { readonly tora: number; readonly lda: number; readonly toda?: number }

const NOT_CREDITED: Record<S9NotCredited, string> = {
  headwind: 'Headwind is not credited: the manual states no range for it.',
  'favourable-slope': 'Favourable slope is not credited: the manual states no range for it.',
}
const FSM_NOT_CREDITED: Record<FsmNotCredited, string> = {
  headwind: 'Headwind is not credited: FSM 3/75 gives no take-off headwind credit.',
  'favourable-slope': 'Favourable slope is not credited: FSM 3/75 states no slope range.',
}
const FSM_ESTIMATE_MARKER = ' ESTIMATED (FSM 3/75)'
const FSM_DISCLOSURE = 'Estimate from LBA FSM 3/75, not from the aircraft manual and not validated by it. The POH surface baseline is unknown; dry paved adds nothing. Downhill slope and headwind are not credited. Wind is not corrected.'
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
  safetyFactor: SafetyFactorSelection = { preset: 'poh-afm', custom: '' },
): CorrectedOperationPresentation {
  const title = OPERATION_LABELS[operation]
  const unavailable = (reason: string): CorrectedOperationPresentation => {
    const omissions = [
      ['Wind component', inputs.headwind, 'kt'], ['Runway slope', inputs.slope, '%'],
    ].flatMap(([label, value, unit]) => {
      const parsed = parseLookupNumber(value!)
      return parsed !== null && parsed !== 0 ? [`${label} ${value} ${unit} was not applied.`] : []
    })
    return { operation, title, status: 'unavailable', reason: [reason, ...omissions].join(' ') }
  }
  if (group?.status !== 'success') return unavailable('No base distance for this operation, so nothing can be corrected.')
  if (sources?.status !== 'assessed') return unavailable('Correction sources cannot be assessed for this profile. Distances stay uncorrected.')
  const rows = sources.corrections.filter((row) => row.operation === operation)
  const selected = rows.map((row) => row.selected)
  const supplied = selected.every((candidate) => candidate && TECNAM_S9_SOURCE_IDS.includes(candidate.id))
  // The FSM fallback is considered only when no complete manual rule set applies.
  const fsm = !supplied && operation === 'takeoff'
    ? rows.filter((row) => row.correction !== 'wind').map((row) => row.selected)
    : []
  const estimating = fsm.length === 2 && fsm.every((candidate) => candidate?.estimate)
  if (!estimating && (!supplied || !selected[0])) return unavailable('No accepted correction source covers wind, surface and slope for this aircraft and runway. Distances stay uncorrected; see Correction sources.')
  if (!runway) return unavailable('Save the manual runway to select its surface correction.')

  const headwindKt = parseLookupNumber(inputs.headwind)
  const slopePercent = parseLookupNumber(inputs.slope)
  if (headwindKt === null) return unavailable('Enter the headwind component in knots (negative for tailwind; 0 for calm).')
  if (slopePercent === null || Math.abs(slopePercent) >= SLOPE_LIMIT_PERCENT) return unavailable('Enter the runway slope in percent (positive uphill in the direction of use; 0 for level), between -100 and 100.')

  const [roll, over50] = group.distances
  if (!roll || !over50) return unavailable('Raw distance rows are incomplete.')
  let result: { groundRoll: number; distanceOver50ft: number; notCredited: readonly string[] }
  if (estimating) {
    const estimate = estimateFsmTakeoff({
      groundRoll: roll.distance, distanceOver50ft: over50.distance,
      surface: `${runway.surface.type}:${runway.surface.condition}`, headwindKt, slopePercent,
    })
    if (estimate.status === 'unsupported') {
      return unavailable(estimate.reason === 'tailwind'
        ? 'FSM 3/75 gives no tailwind value, so no estimate is made. Distances stay uncorrected.'
        : estimate.reason === 'surface'
          ? 'FSM 3/75 has no unambiguous row for this runway surface condition. Distances stay uncorrected.'
          : 'FSM 3/75 states a total-distance surcharge; its ground-roll adaptation for uphill slope or dry short grass may understate it. No estimate is made. Distances stay uncorrected.')
    }
    result = estimate
  } else {
    result = applyTecnamS9Corrections({
      operation, groundRoll: roll.distance, distanceOver50ft: over50.distance,
      surface: runway.surface.type === 'paved' ? 'paved' : 'grass', headwindKt, slopePercent,
    })
  }
  const manualFactor = estimating ? null : TECNAM_S9_RULES[operation].inServiceFactor
  const osf: OperationalSafetyFactorInput = { preset: safetyFactor.preset, pohMandatedFactor: manualFactor === null ? {} : { [operation]: manualFactor } }
  if (safetyFactor.preset === 'custom') {
    const custom = parseLookupNumber(safetyFactor.custom)
    if (custom === null || custom < OSF_MIN || custom > OSF_MAX) return unavailable(`Enter the custom safety factor between ${OSF_MIN.toFixed(2)} and ${OSF_MAX.toFixed(2)}.`)
    osf.customMultiplier = custom
  }
  const factor = resolveOsf(osf, operation)
  const threshold = osfThreshold(osf, operation)
  const up = (value: number) => `${formatNumber(Math.ceil(value), 0)} m`
  const { document, section } = estimating ? fsm[0]! : selected[0]!
  const sourceId = estimating ? 'fsm' : selected[0]!.id
  const comparison = compareWithRunway(operation, Math.ceil(result.distanceOver50ft * factor), Math.ceil(result.groundRoll * factor), available)
  const marker = ' ESTIMATED (CAA SSL 07)'
  const extrapolated = ' ESTIMATED — EXTRAPOLATED (+20 % penalty)'
  const markers = (rows: typeof group.distances) =>
    (rows.some(row => row.extrapolation) ? extrapolated : '') + (rows.some(row => row.provenance === 'estimated') ? marker : '')
  const baseRollMarker = markers([roll])
  const over50Marker = markers([over50])
  const rollMarker = baseRollMarker + (estimating ? FSM_ESTIMATE_MARKER : '')
  const correctedOver50Marker = markers([roll, over50]) + (estimating ? FSM_ESTIMATE_MARKER : '')
  return {
    operation, title, status: 'applied', partial: result.notCredited.length > 0,
    source: `${document.title}, ${document.identifier}, ${document.revision}; ${section}`,
    rows: [
      { label: roll.label, raw: `${formatNumber(roll.distance)} m${baseRollMarker}`, corrected: up(result.groundRoll) + rollMarker, factored: up(result.groundRoll * factor) + rollMarker },
      { label: over50.label, raw: `${formatNumber(over50.distance)} m${over50Marker}`, corrected: up(result.distanceOver50ft) + correctedOver50Marker, factored: up(result.distanceOver50ft * factor) + correctedOver50Marker },
    ],
    comparison: { ...comparison, required: comparison.required + correctedOver50Marker, margin: comparison.margin === 'Not available' ? comparison.margin : comparison.margin + correctedOver50Marker,
      summary: rollMarker ? comparison.summary.replace(/(final ground roll of [\d,]+ m)/, `$1${rollMarker}`) : comparison.summary },
    safetyFactor: `${factor.toFixed(2)} (${estimating && safetyFactor.preset === 'poh-afm' ? 'Regulatory baseline; no manual factor' : SAFETY_FACTOR_PRESETS.find((p) => p.value === safetyFactor.preset)!.label})`,
    safetyFactorWarning: isOsfBelowMinimum(osf, operation)
      ? `WARN-PF-002: safety factor ${factor.toFixed(2)} is below the recommended minimum ${threshold.toFixed(2)} (${manualFactor === null ? 'regulatory baseline' : `greater of the manual factor ${manualFactor} and the regulatory baseline`}). Advisory; the result is not blocked.`
      : null,
    notes: [
      `Final value = corrected distance × safety factor ${factor.toFixed(2)}, rounded up to whole metres.${manualFactor === null ? '' : ` The manual states ${manualFactor} as its in-service factor.`}`,
      ...(estimating ? [FSM_DISCLOSURE] : []),
      ...result.notCredited.map((item) => `${estimating ? FSM_NOT_CREDITED[item as FsmNotCredited] : NOT_CREDITED[item as S9NotCredited]} ${item === 'headwind' ? `Wind component ${inputs.headwind} kt` : `Runway slope ${inputs.slope} %`} was not applied.`),
      ...(operation === 'landing' && sourceId.startsWith('tecnam-s9-') ? ['The manual landing table exists for 650 kg only; lower masses use it unchanged.'] : []),
      'Check the applicable aircraft manual. This is not an operational approval or go/no-go decision.',
    ],
  }
}

/**
 * Compares the final distance over 50 ft with TORA (take-off) or LDA (landing). Equal distances are sufficient with zero margin.
 */
function compareWithRunway(operation: Operation, requiredM: number, rollM: number, available: AvailableDistancesM | null): RunwayComparison {
  const takeoff = operation === 'takeoff'
  const useToda = takeoff && available?.toda !== undefined
  const availableLabel = takeoff ? (useToda ? 'TODA' : 'TORA') : 'LDA'
  const availableM = available ? (takeoff ? (available.toda ?? available.tora) : available.lda) : null
  const required = `${formatNumber(requiredM, 0)} m`
  if (availableM === null || !Number.isFinite(availableM) || availableM <= 0) {
    return { status: 'unavailable', availableLabel, required, available: 'Not available', margin: 'Not available',
      summary: `Runway ${availableLabel} is not available, so the distance cannot be compared.` }
  }
  const { absolute, percent } = safetyMargin(availableM, requiredM)
  // With a clearway the 50 ft distance may use TODA, but the ground roll must still fit TORA.
  const rollFits = !useToda || rollM <= available!.tora
  const sufficient = absolute >= 0 && rollFits
  const signed = `${absolute >= 0 ? '+' : '−'}${formatNumber(Math.abs(absolute), 1)} m`
  const pct = percent === null ? '' : ` (${percent >= 0 ? '+' : '−'}${formatNumber(Math.abs(percent), 1)} %)`
  return {
    status: sufficient ? 'sufficient' : 'insufficient', availableLabel, required,
    available: `${formatNumber(availableM, 1)} m`, margin: `${signed}${pct}`,
    summary: sufficient
      ? `Final distance over 50 ft fits the declared ${availableLabel}.`
      : !rollFits ? `Runway insufficient: the final ground roll of ${formatNumber(rollM, 0)} m exceeds the declared TORA of ${formatNumber(available!.tora, 1)} m.`
      : `Runway insufficient: the final distance over 50 ft exceeds the declared ${availableLabel}.`,
  }
}
