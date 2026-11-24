import type { Operation, RunwayFacts, SourceAssessment } from '@/core/logic/performance.correction-sources'
import { isOsfBelowMinimum, osfThreshold, OSF_MAX, OSF_MIN, resolveOsf, safetyMargin } from '@/core/logic/performance.safety-factor'
import type { OperationalSafetyFactorInput, OsfPreset } from '@/core/domain/performance.math-types'
import { applyTecnamS9Corrections, TECNAM_S9_RULES, TECNAM_S9_SOURCE_IDS, type S9NotCredited } from '@/core/logic/performance.tecnam-s9-corrections'
import { estimateFsmTakeoff, type FsmNotCredited } from '@/core/logic/performance.fsm-estimates'
import { OPERATION_LABELS } from './correction-source-messages'
import { formatNumber, LOWER_AXIS_ESTIMATE } from './performance-presentation'
import { parseLookupNumber, type GroupAssessment } from './poh-inspection'

/** Pilot-entered conditions for one operation; raw text so an empty field is never zero. */
export type CorrectionConditions = { headwind: string; slope: string; windFactor?: string; windAddend?: string; windSource?: string; surfaceFactor?: string; surfaceSource?: string; slopeFactor?: string; slopeAddend?: string; slopeSource?: string }
export type CorrectionInputs = Record<Operation, CorrectionConditions>
export const emptyCorrectionInputs = (): CorrectionInputs => ({
  takeoff: { headwind: '', slope: '', windFactor: '', windSource: '' }, landing: { headwind: '', slope: '', windFactor: '', windSource: '' },
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
const FSM_DISCLOSURE = 'Estimate from LBA FSM 3/75, not from the aircraft manual and not validated by it. The POH surface baseline is unknown; dry paved adds nothing. FSM does not credit downhill slope or headwind and supplies no wind correction. The source applies its percentages to total distance; this ground-roll adaptation can understate that surcharge and is not conservative against it.'
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
      return value!.trim() ? [`${label} ${value} ${unit} was not applied.`] : []
    })
    return { operation, title, status: 'unavailable', reason: [reason, ...omissions, ...(runway ? ['The saved runway surface was not applied.'] : []), 'The selected safety factor was not applied. Do not use the uncorrected base distances for runway assessment; determine the applicable corrections and safety factor independently from the aircraft manual.'].join(' ') }
  }
  if (group?.status !== 'success') return unavailable('No base distance for this operation, so nothing can be corrected.')
  if (sources?.status !== 'assessed') return unavailable('Correction sources cannot be assessed for this profile. Distances stay uncorrected.')
  const windFactorText = inputs.windFactor?.trim() ?? ''
  const windAddendText = inputs.windAddend?.trim() ?? ''
  const windAddend = windAddendText ? parseLookupNumber(windAddendText) : null
  const windSource = inputs.windSource?.trim() ?? ''
  const windFactor = windFactorText ? parseLookupNumber(windFactorText) : null
  if (windFactorText && windAddendText) return unavailable('Enter either a manual wind multiplier or an additive wind correction, not both.')
  if ((windFactorText || windAddendText || windSource) && (!windSource || (windFactorText ? windFactor === null || windFactor <= 0 : windAddend === null))) return unavailable('Enter a positive finite manual wind multiplier and its source, or a finite additive wind correction and its source, or clear all fields.')
  const pilotWind = windFactor !== null || windAddend !== null
  const surfaceFactorText = inputs.surfaceFactor?.trim() ?? ''
  const surfaceSource = inputs.surfaceSource?.trim() ?? ''
  const surfaceFactor = surfaceFactorText ? parseLookupNumber(surfaceFactorText) : null
  if ((surfaceFactorText || surfaceSource) && (surfaceFactor === null || surfaceFactor <= 0 || !surfaceSource)) return unavailable('Enter a positive finite manual surface multiplier and its source and section, or clear both fields.')
  const slopeFactorText = operation === 'landing' ? inputs.slopeFactor?.trim() ?? '' : ''
  const slopeAddendText = operation === 'landing' ? inputs.slopeAddend?.trim() ?? '' : ''
  const slopeAddend = slopeAddendText ? parseLookupNumber(slopeAddendText) : null
  const slopeSource = operation === 'landing' ? inputs.slopeSource?.trim() ?? '' : ''
  const slopeFactor = slopeFactorText ? parseLookupNumber(slopeFactorText) : null
  if (slopeFactorText && slopeAddendText) return unavailable('Enter either a landing slope multiplier or an additive correction, not both.')
  if ((slopeFactorText || slopeAddendText || slopeSource) && (!slopeSource || (slopeFactorText ? slopeFactor === null || slopeFactor <= 0 : slopeAddend === null))) return unavailable('Enter a positive finite manual landing slope multiplier or a finite additive correction and its source, or clear all fields.')
  const pilotSlope = slopeFactor !== null || slopeAddend !== null
  const rows = sources.corrections.filter((row) => row.operation === operation)
  const manual = rows.filter((row) => row.selected && TECNAM_S9_SOURCE_IDS.includes(row.selected.id) && !(pilotWind && row.correction === 'wind') && !(surfaceFactor !== null && row.correction === 'surface') && !(pilotSlope && row.correction === 'slope'))
  const fsm = operation === 'takeoff' ? rows.filter((row) => row.selected?.estimate && !(surfaceFactor !== null && row.correction === 'surface')) : []
  const estimating = fsm.length > 0
  if (!runway) return unavailable('Save the manual runway to select its surface correction.')

  const headwindKt = parseLookupNumber(inputs.headwind)
  const slopePercent = parseLookupNumber(inputs.slope)
  const inputErrors = [
    ...(headwindKt === null ? ['Enter the headwind component in knots (negative for tailwind; 0 for calm).'] : []),
    ...(slopePercent === null || Math.abs(slopePercent) >= SLOPE_LIMIT_PERCENT ? ['Enter the runway slope in percent (positive uphill in the direction of use; 0 for level), between -100 and 100.'] : []),
  ]
  if (headwindKt === null || slopePercent === null || inputErrors.length) return unavailable(inputErrors.join(' '))

  const [roll, over50] = group.distances
  if (!roll || !over50) return unavailable('Raw distance rows are incomplete.')
  let result: { groundRoll: number; distanceOver50ft: number; notCredited: readonly string[] }
  if (estimating) {
    const estimate = estimateFsmTakeoff({
      groundRoll: roll.distance, distanceOver50ft: over50.distance,
      surface: fsm.some((row) => row.correction === 'surface') ? `${runway.surface.type}:${runway.surface.condition}` : 'paved:dry',
      headwindKt: 0,
      slopePercent: fsm.some((row) => row.correction === 'slope') ? slopePercent : 0,
    })
    if (estimate.status === 'unsupported') return unavailable('FSM 3/75 has no unambiguous row for this runway surface condition.')
    result = estimate
  } else {
    result = { groundRoll: roll.distance, distanceOver50ft: over50.distance, notCredited: [] }
  }
  if (manual.length) {
    const corrected = applyTecnamS9Corrections({
      operation, groundRoll: result.groundRoll, distanceOver50ft: result.distanceOver50ft,
      surface: manual.some((row) => row.correction === 'surface') && runway.surface.type === 'paved' ? 'paved' : 'grass',
      headwindKt: manual.some((row) => row.correction === 'wind') ? headwindKt : 0,
      slopePercent: manual.some((row) => row.correction === 'slope') ? slopePercent : 0,
    })
    result = { ...corrected, notCredited: [...result.notCredited, ...corrected.notCredited] }
  }
  if (estimating && !pilotWind && !manual.some((row) => row.correction === 'wind') && headwindKt > 0) {
    result = { ...result, notCredited: [...result.notCredited, 'headwind'] }
  }
  if (surfaceFactor !== null) {
    const groundRoll = result.groundRoll * surfaceFactor
    const distanceOver50ft = result.distanceOver50ft - result.groundRoll + groundRoll
    if (!Number.isFinite(groundRoll) || !Number.isFinite(distanceOver50ft) || groundRoll <= 0 || distanceOver50ft <= 0) return unavailable('Manual surface multiplier produces an invalid distance.')
    result = { ...result, groundRoll, distanceOver50ft }
  }
  if (pilotSlope) {
    const groundRoll = slopeFactor !== null ? result.groundRoll * slopeFactor : result.groundRoll + slopeAddend!
    result = { ...result, distanceOver50ft: result.distanceOver50ft + groundRoll - result.groundRoll, groundRoll }
    if (!Number.isFinite(result.groundRoll) || !Number.isFinite(result.distanceOver50ft) || result.groundRoll <= 0 || result.distanceOver50ft <= 0) return unavailable('Manual landing slope correction produces an invalid distance.')
  }
  if (windFactor !== null) {
    result = { ...result, groundRoll: result.groundRoll * windFactor, distanceOver50ft: result.distanceOver50ft * windFactor }
    if (!Number.isFinite(result.groundRoll) || !Number.isFinite(result.distanceOver50ft) || result.groundRoll <= 0 || result.distanceOver50ft <= 0) return unavailable('Manual wind multiplier produces an invalid distance.')
  }
  if (windAddend !== null) {
    result = { ...result, groundRoll: result.groundRoll + windAddend, distanceOver50ft: result.distanceOver50ft + windAddend }
    if (!Number.isFinite(result.groundRoll) || !Number.isFinite(result.distanceOver50ft) || result.groundRoll <= 0 || result.distanceOver50ft <= 0) return unavailable('Manual additive wind correction produces an invalid distance.')
  }
  const manualFactor = rows.some((row) => row.selected && TECNAM_S9_SOURCE_IDS.includes(row.selected.id)) ? TECNAM_S9_RULES[operation].inServiceFactor : null
  const osf: OperationalSafetyFactorInput = { preset: safetyFactor.preset, pohMandatedFactor: manualFactor === null ? {} : { [operation]: manualFactor } }
  if (safetyFactor.preset === 'custom') {
    const custom = parseLookupNumber(safetyFactor.custom)
    if (custom === null || custom < OSF_MIN || custom > OSF_MAX) return unavailable(`Enter the custom safety factor between ${OSF_MIN.toFixed(2)} and ${OSF_MAX.toFixed(2)}.`)
    osf.customMultiplier = custom
  }
  const factor = resolveOsf(osf, operation)
  if (!Number.isFinite(result.groundRoll * factor) || !Number.isFinite(result.distanceOver50ft * factor)) return unavailable('Corrected distances exceed the supported numeric range.')
  const threshold = osfThreshold(osf, operation)
  const up = (value: number) => `${formatNumber(Math.ceil(value), 0)} m`
  const selected = estimating ? fsm[0]!.selected! : manual[0]?.selected
  const sourceId = estimating ? 'fsm' : selected?.id ?? ''
  const comparison = compareWithRunway(operation, Math.ceil(result.distanceOver50ft * factor), Math.ceil(result.groundRoll * factor), available)
  const missing = rows.filter((row) => !manual.includes(row) && !fsm.includes(row) && !(row.correction === 'wind' && pilotWind) && !(row.correction === 'surface' && surfaceFactor !== null) && !(row.correction === 'slope' && pilotSlope) && (row.correction !== 'wind' || headwindKt < 0 || !estimating)).map((row) => row.correction)
  const partial = surfaceFactor !== null || pilotSlope || pilotWind || result.notCredited.length > 0 || missing.length > 0
  const marker = ' ESTIMATED (CAA SSL 07)'
  const extrapolated = ' ESTIMATED — EXTRAPOLATED (+20 % penalty)'
  const markers = (rows: typeof group.distances) =>
    (rows.some(row => row.lowerAxisCaps.length) ? ` ${LOWER_AXIS_ESTIMATE}` : '') + (rows.some(row => row.extrapolation) ? extrapolated : '') + (rows.some(row => row.provenance === 'estimated') ? marker : '')
  const baseRollMarker = markers([roll])
  const over50Marker = markers([over50])
  const windMarker = windFactor !== null ? ' [UNVERIFIED PILOT-ENTERED WIND FACTOR]' : windAddend !== null ? ' [UNVERIFIED PILOT-ENTERED WIND ADDEND]' : ''
  const surfaceMarker = surfaceFactor !== null ? ' [UNVERIFIED PILOT-ENTERED SURFACE FACTOR]' : ''
  const slopeMarker = slopeFactor !== null ? ' [UNVERIFIED PILOT-ENTERED SLOPE FACTOR]' : slopeAddend !== null ? ' [UNVERIFIED PILOT-ENTERED SLOPE ADDEND]' : ''
  const rollMarker = baseRollMarker + (estimating ? FSM_ESTIMATE_MARKER : '') + windMarker + surfaceMarker + slopeMarker
  const correctedOver50Marker = markers([roll, over50]) + (estimating ? FSM_ESTIMATE_MARKER : '') + windMarker + surfaceMarker + slopeMarker
  return {
    operation, title, status: 'applied', partial,
    source: selected ? `${selected.document.title}, ${selected.document.identifier}, ${selected.document.revision}; ${selected.section}${estimating && manual.length ? `; ${manual[0]!.selected!.document.title}, ${manual[0]!.selected!.document.revision}; ${manual[0]!.selected!.section}` : ''}` : surfaceFactor !== null ? 'Pilot-entered surface multiplier; source and applicability unverified' : pilotSlope ? 'Pilot-entered landing slope correction; source and applicability unverified' : pilotWind ? 'Pilot-entered wind correction; source and applicability unverified' : 'No applicable wind, surface or slope correction source',
    rows: [
      { label: roll.label, raw: `${formatNumber(roll.distance)} m${baseRollMarker}`, corrected: up(result.groundRoll) + rollMarker, factored: up(result.groundRoll * factor) + rollMarker },
      { label: over50.label, raw: `${formatNumber(over50.distance)} m${over50Marker}`, corrected: up(result.distanceOver50ft) + correctedOver50Marker, factored: up(result.distanceOver50ft * factor) + correctedOver50Marker },
    ],
    comparison: { ...comparison, status: partial && comparison.status === 'sufficient' ? 'unavailable' : comparison.status,
      required: comparison.required + correctedOver50Marker, margin: partial ? 'Not available' : comparison.margin === 'Not available' ? comparison.margin : comparison.margin + correctedOver50Marker,
      summary: (partial && comparison.status === 'sufficient' ? 'Runway comparison unavailable.' : rollMarker ? comparison.summary.replace(/(final ground roll of [\d,]+ m)/, `$1${rollMarker}`) : comparison.summary)
        + (partial ? ' Comparison uses partially corrected distances; see unapplied inputs below. Do not use this comparison for runway assessment; determine the applicable corrections independently from the aircraft manual.' : '') },
    safetyFactor: `${factor.toFixed(2)} (${manualFactor === null && safetyFactor.preset === 'poh-afm' ? 'Regulatory baseline; no manual factor' : SAFETY_FACTOR_PRESETS.find((p) => p.value === safetyFactor.preset)!.label})`,
    safetyFactorWarning: isOsfBelowMinimum(osf, operation)
      ? `WARN-PF-002: safety factor ${factor.toFixed(2)} is below the recommended minimum ${threshold.toFixed(2)} (${manualFactor === null ? 'regulatory baseline' : `greater of the manual factor ${manualFactor} and the regulatory baseline`}). Advisory; the result is not blocked.`
      : null,
    notes: [
      `Final value = corrected distance × safety factor ${factor.toFixed(2)}, rounded up to whole metres.${manualFactor === null ? '' : ` The manual states ${manualFactor} as its in-service factor.`}`,
      ...(estimating ? [FSM_DISCLOSURE] : []),
      ...(surfaceFactor !== null ? [`Pilot-entered surface multiplier ${surfaceFactor}, source and section: ${surfaceSource}. Applied to ground roll only, after built-in slope and wind corrections and before pilot-entered wind and safety factors. Source, applicability and correction ordering are unverified; independently check the aircraft manual. Additive or differently ordered surface rules are unsupported.`] : []),
      ...(slopeFactor !== null ? [`Pilot-entered landing slope multiplier ${slopeFactor} for ${inputs.slope} %, source: ${slopeSource}. Applied to ground roll only; the airborne segment is unchanged. Source, applicability and correction order are not verified; independently check the manual and combined corrections.`] : []),
      ...(slopeAddend !== null ? [`Pilot-entered additive landing slope correction ${slopeAddend} m for ${inputs.slope} %, source and section: ${slopeSource}. Applied to ground roll after built-in and pilot-entered surface corrections and before pilot-entered wind and safety factors; the airborne segment is unchanged. Source, applicability and ordering are unverified; independently check the aircraft manual.`] : []),
      ...(windAddend !== null ? [`Pilot-entered additive wind correction ${windAddend} m for ${inputs.headwind} kt, source and section: ${windSource}. Applied to both distances after ground corrections and before the safety factor. Source, applicability and ordering are unverified; independently check the aircraft manual.`] : []),
      ...(windFactor !== null ? [`Pilot-entered wind multiplier ${windFactor} for ${inputs.headwind} kt, source: ${windSource}. Applied to both distances. Source and applicability are not verified; independently check the manual and combined corrections.`] : []),
      ...(missing.length ? [`Incomplete: no applicable correction applied for ${missing.join(', ')}.${missing.includes('wind') ? ` Wind component ${inputs.headwind} kt was not applied.` : ''}${missing.includes('slope') ? ` Runway slope ${inputs.slope} % was not applied.` : ''} Determine missing corrections independently from the aircraft manual.`] : []),
      ...result.notCredited.map((item) => `${fsm.some((row) => row.correction === (item === 'headwind' ? 'wind' : 'slope')) || (item === 'headwind' && estimating && !manual.some((row) => row.correction === 'wind')) ? FSM_NOT_CREDITED[item as FsmNotCredited] : NOT_CREDITED[item as S9NotCredited]} ${item === 'headwind' ? `Wind component ${inputs.headwind} kt` : `Runway slope ${inputs.slope} %`} was not applied.`),
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
