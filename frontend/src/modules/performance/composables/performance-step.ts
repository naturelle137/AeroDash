import { computed, reactive, ref, shallowRef, watch } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { assessCorrectionSources, OPERATIONS, profileFacts, type ManualConfiguration, type Operation, type RunwayFacts } from '@/core/logic/performance.correction-sources'
import { hasManualRunwayDraftContent, daysToDeclaredEffect, daysToDeclaredExpiry, normalizeManualRunway, runwayFreshness, SURFACE_CONDITIONS, validateManualRunway } from '@/core/logic/manual-runway'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'
import { plainCopy, useDemoScratch } from '@/shared/composables/useDemoScratch'
import { usePressureAltitudeInput } from './pressure-altitude-input'
import { TEMPERATURE_ADVISORY_C } from '@/core/logic/pressure-altitude'
import { assessPerformance, inspectTables, parseLookupNumber, type MassSource, type PerformanceAssessment } from '../services/poh-inspection'
import { OPERATION_LABELS } from '../services/correction-source-messages'
import { defaultSafetyFactors, emptyCorrectionInputs, presentCorrectedOperation } from '../services/corrected-distances'
import { assessObstacle, describeGradient, describeObstacle, emptyObstacleInput, obstacleNotification } from '../services/obstacle-constraint'
import { presentOperationalAssessment, presentPerformance, type PerformancePresentation, type RunwayPresentation } from '../services/performance-presentation'

/** Everything outside this step that a result depends on. */
export type PerformanceStepContext = {
  /** Fleet loaded and no selection awaiting acknowledgement. */
  revision?: string
  ready: boolean
  notReadyReason: string
  profile: AircraftProfile | null
  category: string | null
  takeoff: MassSource
  landing: MassSource
}

type ComputedResult = { key: string; assessment: PerformanceAssessment; basis: string }

/**
 * One Performance step: session-only conditions, live calculation and a typed
 * presentation. A result is shown only while its input key equals the current
 * key, so a changed profile, category, mass, runway, condition or unit preference
 * can never display an older result.
 */
export function usePerformanceStep(context: () => PerformanceStepContext) {
  const pa = usePressureAltitudeInput()
  const runway = useManualRunwayStore()
  const units = useLoadedUnitPreferences()
  const temperature = ref('')
  const showPaErrors = ref(false)
  // Only a valid, explicitly entered value is judged; blank or invalid text keeps the existing input validation.
  const temperatureWarnings = computed(() => {
    const value = parseLookupNumber(temperature.value)
    return value !== null && (value < TEMPERATURE_ADVISORY_C.min || value > TEMPERATURE_ADVISORY_C.max)
      ? [`WARNING WARN-UI-001: Temperature ${value} °C is outside the standard ${TEMPERATURE_ADVISORY_C.min}–${TEMPERATURE_ADVISORY_C.max} °C range. Check the value.`] : []
  })
  const corrections = reactive(emptyCorrectionInputs())
  const safetyFactors = reactive(defaultSafetyFactors())
  const obstacle = reactive(emptyObstacleInput())
  const obstacleAssessment = computed(() => assessObstacle(obstacle))
  const ctx = computed(context)
  const manualConfiguration = ref<ManualConfiguration>('')
  watch(() => JSON.stringify(ctx.value.profile), () => { manualConfiguration.value = '' }, { flush: 'sync' })

  useDemoScratch(
    () => plainCopy({ pa: pa.snapshot(), temperature: temperature.value, corrections, safetyFactors, obstacle, manualConfiguration: manualConfiguration.value }),
    (saved) => {
      pa.restore(saved.pa)
      temperature.value = saved.temperature
      Object.assign(corrections, saved.corrections)
      Object.assign(safetyFactors, saved.safetyFactors)
      Object.assign(obstacle, saved.obstacle)
      manualConfiguration.value = saved.manualConfiguration
    },
  )

  const profileKey = computed(() => JSON.stringify(ctx.value.profile))
  const inputKey = computed(() => JSON.stringify([
    ctx.value.revision, ctx.value.ready, profileKey.value, ctx.value.category, ctx.value.takeoff, ctx.value.landing,
    pa.revision.value, temperature.value, corrections, safetyFactors, obstacle, units.preferences, manualConfiguration.value,
    runway.saved, runway.draft, runway.storageError, runway.hasUnsavedChanges, runway.assessmentDate, runway.today, runway.automaticDate,
  ]))
  // A pilot-derived factor belongs only to the exact conditions for which it was entered.
  for (const operation of OPERATIONS) {
    watch(() => JSON.stringify([ctx.value, pa.revision.value, temperature.value, corrections[operation].headwind, corrections[operation].slope, runway.saved, runway.draft, manualConfiguration.value]), () => {
      corrections[operation].windFactor = ''
      corrections[operation].windAddend = ''
      corrections[operation].windSource = ''
      corrections[operation].surfaceFactor = ''
      corrections[operation].surfaceAddend = ''
      corrections[operation].surfaceSource = ''
      corrections[operation].slopeFactor = ''
      corrections[operation].slopeAddend = ''
      corrections[operation].slopeSource = ''
    }, { flush: 'sync' })
  }
  const result = shallowRef<ComputedResult | null>(null)
  // Bound to the exact input key: any later input, profile, mass or runway change leaves the key behind.
  const acknowledgedKey = ref<string | null>(null)
  // Forget it on any change, so returning to an earlier input never restores an old acknowledgment.
  watch(inputKey, () => { acknowledgedKey.value = null }, { flush: 'sync' })
  const extrapolationAcknowledged = computed({
    get: () => acknowledgedKey.value === inputKey.value,
    set: (value: boolean) => { acknowledgedKey.value = value ? inputKey.value : null },
  })
  const current = computed(() => result.value?.key === inputKey.value ? result.value : null)
  const tables = computed(() => ctx.value.profile ? inspectTables(ctx.value.profile) : null)

  function compute(): void {
    showPaErrors.value = true
    const key = inputKey.value
    const { ready, notReadyReason, profile, takeoff, landing } = ctx.value
    const block = (reason: 'profile' | 'input', message: string) => {
      result.value = { key, assessment: { status: 'blocked', reason, message }, basis: '' }
    }
    if (!ready) return block('profile', notReadyReason)
    if (!profile) return block('profile', 'Select an aircraft profile before computing.')
    const resolved = pa.resolution.value
    if (resolved.status === 'blocked') return block('input', resolved.message)
    const assessment = assessPerformance(profile, { takeoff, landing, pressureAltitude: resolved.value, temperature: temperature.value }, new Date())
    const basis = resolved.method === 'direct'
      ? `${resolved.value.trim()} ft, entered directly`
      : `${resolved.displayFt} ft, derived from QNH and field elevation (unrounded value used)`
    result.value = { key, assessment, basis }
  }

  // Synchronous recomputation also covers incomplete edits before a native print event.
  watch(inputKey, compute, { flush: 'sync', immediate: true })

  const runwayPresentation = computed<RunwayPresentation>(() => {
    if (runway.storageError) return { status: 'unavailable', reason: runway.storageError }
    const declared = runway.current
    if (!declared) {
      const reason = runway.hasUnsavedChanges ? 'Manual runway has unsaved changes. Save or discard them to use a current declaration.' : 'No saved manual runway declaration.'
      const { effectiveDate, expiryDate, source } = runway.draft
      if (!runway.hasUnsavedChanges && !hasManualRunwayDraftContent(runway.draft)) return { status: 'unavailable', reason }
      const selected = runwayFreshness(runway.draft, runway.assessmentDate)
      const device = runwayFreshness(runway.draft, runway.today)
      const validation = validateManualRunway(runway.draft)
      const dateError = validation.status === 'invalid' ? validation.errors.effectiveDate || validation.errors.expiryDate : undefined
      return { status: 'unavailable', reason: `${reason} Unsaved source: ${source.trim() || 'Unknown'} (user-declared, unverified); effective: ${effectiveDate || 'Unknown'}; expiry (inclusive): ${expiryDate || 'Unknown'}. Unsaved declaration date check: ${runway.assessmentDate || 'Invalid date'}: ${selected}; device date ${runway.today}: ${device}.${dateError ? ` Date check unavailable: ${dateError}` : ''}${!runway.automaticDate && selected !== device ? ' The selected and device date checks differ; confirm the intended date.' : ''} Pilot-declared dates only; source currency is unverified and NOTAM/SUP coverage is unknown.` }
    }
    const { aerodrome, designator, tora, lda, toda, fieldElevation, surface, source, effectiveDate, expiryDate } = declared.record.runway
    const dateChecksDiffer = !runway.automaticDate && runwayFreshness(declared.record.runway, runway.assessmentDate) !== runwayFreshness(declared.record.runway, runway.today)
    const condition = SURFACE_CONDITIONS[surface.type].find((option) => option.value === surface.condition)?.label ?? surface.condition
    const elevationOther = fieldElevation.unit === 'ft' ? `${declared.display.fieldElevationM} m` : `${declared.display.fieldElevationFt} ft`
    return {
      status: 'declared',
      label: `${aerodrome} — runway ${designator}`,
      rows: [
        { label: 'TORA', value: `${tora.value} ${tora.unit} (${declared.display.toraM} m)` },
        { label: 'LDA', value: `${lda.value} ${lda.unit} (${declared.display.ldaM} m)` },
        ...(toda ? [{ label: 'TODA', value: `${toda.value} ${toda.unit} (${declared.display.todaM} m)` }] : []),
        { label: 'Field elevation', value: `${fieldElevation.value} ${fieldElevation.unit} (${elevationOther})` },
        { label: 'Source reference', value: `${source ?? 'Unknown'} (user-declared, unverified)` },
        { label: 'Declared effective date', value: effectiveDate ?? 'Unknown' },
        { label: 'Declared expiry date (inclusive)', value: expiryDate ?? 'Unknown' },
        { label: 'Declared date check', value: `${runway.assessmentDate || 'Invalid date'}: ${runwayFreshness(declared.record.runway, runway.assessmentDate)}; source currency unverified` },
        ...(!runway.automaticDate ? [{ label: 'Device-date check', value: `${runway.today}: ${runwayFreshness(declared.record.runway, runway.today)}; source currency unverified` }] : []),
        { label: 'Days to declared effect', value: daysToDeclaredEffect(declared.record.runway, runway.assessmentDate)?.toString() ?? 'Unknown' },
        { label: 'Days to declared expiry', value: daysToDeclaredExpiry(declared.record.runway, runway.assessmentDate)?.toString() ?? 'Unknown' },
        ...(!runway.automaticDate ? [
          { label: 'Device-date days to declared effect', value: daysToDeclaredEffect(declared.record.runway, runway.today)?.toString() ?? 'Unknown' },
          { label: 'Device-date days to declared expiry', value: daysToDeclaredExpiry(declared.record.runway, runway.today)?.toString() ?? 'Unknown' },
        ] : []),
        { label: 'Surface', value: `${surface.type === 'paved' ? 'Paved' : surface.type === 'grass' ? 'Grass' : 'Other / legacy unpaved'} · ${condition}` },
      ],
      note: `User-entered, not airport-validated. ${runway.automaticDate ? 'The check date follows the device’s local date; check the device date.' : 'The selected check date does not advance automatically; confirm it for your flight.'} ${dateChecksDiffer ? 'The selected and device date checks differ; confirm the intended date. ' : ''}NOTAM/SUP coverage is unknown; check declared dates and restrictions against official sources. Converted available distances are rounded down.`,
    }
  })

  const runwayFacts = computed<RunwayFacts | null>(() => !runway.storageError && runway.current ? {
    label: `${runway.current.record.runway.aerodrome} ${runway.current.record.runway.designator}`,
    surface: runway.current.record.runway.surface,
  } : null)
  /** Same 0.1 m round-down as the runway display, so margins match what the pilot sees. */
  const availableM = computed(() => {
    const normalized = !runway.storageError && runway.current ? normalizeManualRunway(runway.current.record.runway) : null
    const down = (value: number) => Math.floor(value * 10 + 1e-9) / 10
    return normalized ? { tora: down(normalized.toraM), lda: down(normalized.ldaM), ...(normalized.todaM !== undefined ? { toda: down(normalized.todaM) } : {}) } : null
  })
  const sources = computed(() => ctx.value.ready && ctx.value.profile
    ? assessCorrectionSources({ ...profileFacts(ctx.value.profile, tables.value?.status === 'ready'), manualConfiguration: manualConfiguration.value }, runwayFacts.value) : null)
  const groupOf = (operation: Operation) => {
    const assessment = current.value?.assessment
    const group = assessment?.status === 'assessed' ? assessment[operation] : null
    // An unacknowledged extrapolated result is not accepted, so no correction or comparison may build on it.
    return group?.status === 'success' && group.extrapolated && !extrapolationAcknowledged.value ? null : group
  }

  const presentation = computed<PerformancePresentation>(() => {
    const { ready, notReadyReason, profile, category, takeoff, landing } = ctx.value
    return presentPerformance({
      inputKey: inputKey.value,
      warnings: [...pa.warnings.value, ...temperatureWarnings.value],
      inputs: [
        { label: 'Pressure altitude method', value: pa.method.value === 'direct' ? 'Direct entry' : pa.method.value === 'qnh-elevation' ? 'Derived from QNH and field elevation' : 'Not selected' },
        ...(pa.method.value === 'direct' ? [{ label: 'Entered pressure altitude', value: `${pa.direct.value.trim() || 'Not entered'} ft` }]
          : pa.method.value === 'qnh-elevation' ? [
            { label: 'QNH', value: `${pa.draft.qnh.trim() || 'Not entered'} ${pa.draft.qnhUnit}`, warnings: pa.warnings.value },
            { label: 'Field elevation', value: `${pa.draft.elevation.trim() || 'Not entered'} ${pa.draft.elevationUnit}` },
            { label: 'Field elevation source', value: pa.elevationProvenance.value },
          ] : []),
        { label: 'Outside air temperature', value: `${temperature.value.trim() || 'Not entered'} °C`, warnings: temperatureWarnings.value },
        ...OPERATIONS.flatMap((operation) => [
          { label: `${OPERATION_LABELS[operation]} headwind component`, value: `${corrections[operation].headwind.trim() || 'Not entered'} kt` },
          { label: `${OPERATION_LABELS[operation]} runway slope`, value: `${corrections[operation].slope.trim() || 'Not entered'} %` },
          { label: `${OPERATION_LABELS[operation]} pilot-entered surface multiplier`, value: corrections[operation].surfaceFactor ? `${corrections[operation].surfaceFactor} · ${corrections[operation].surfaceSource || 'source and section not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} pilot-entered additive surface correction`, value: corrections[operation].surfaceAddend ? `${corrections[operation].surfaceAddend} m · ${corrections[operation].surfaceSource || 'source and section not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} pilot-entered slope multiplier`, value: corrections[operation].slopeFactor ? `${corrections[operation].slopeFactor} · ${corrections[operation].slopeSource || 'source not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} pilot-entered additive slope correction`, value: corrections[operation].slopeAddend ? `${corrections[operation].slopeAddend} m · ${corrections[operation].slopeSource || 'source not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} pilot-entered wind multiplier`, value: corrections[operation].windFactor ? `${corrections[operation].windFactor} · ${corrections[operation].windSource || 'source not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} pilot-entered additive wind correction`, value: corrections[operation].windAddend ? `${corrections[operation].windAddend} m · ${corrections[operation].windSource || 'source not entered'} (unverified)` : 'Not entered' },
          { label: `${OPERATION_LABELS[operation]} safety factor`, value: safetyFactors[operation].preset === 'custom' ? `Custom ${safetyFactors[operation].custom.trim() || 'not entered'}` : safetyFactors[operation].preset },
        ]),
        { label: 'Unverified obstacle constraint', value: describeObstacle(obstacleAssessment.value) },
        ...(obstacleAssessment.value.status === 'active' ? [{ label: 'Required geometric gradient', value: describeGradient(obstacleAssessment.value) }] : []),
      ],
      notifications: obstacleNotification(obstacleAssessment.value),
      obstacleActive: obstacleAssessment.value.status === 'active',
      aircraft: profile ? { registration: profile.registration, model: `${profile.manufacturer} ${profile.model}`, category } : null,
      takeoff,
      landing,
      assessment: current.value?.assessment ?? null,
      extrapolationAcknowledged: extrapolationAcknowledged.value,
      pressureAltitudeBasis: current.value?.basis ?? '',
      pendingReason: !ready ? notReadyReason
        : !profile ? 'Select an aircraft profile.'
          : 'Choose the pressure-altitude method and enter the current conditions.',
      runway: runwayPresentation.value,
      operational: presentOperationalAssessment(sources.value, !ready ? notReadyReason : 'Select an aircraft profile.'),
      corrected: current.value ? OPERATIONS.map((operation) => presentCorrectedOperation(
        operation, groupOf(operation), sources.value, runwayFacts.value, corrections[operation], availableM.value, safetyFactors[operation])) : [],
    })
  })

  const annotationWarnings = computed(() => [...new Set([
    ...pa.warnings.value, ...temperatureWarnings.value,
    ...presentation.value.notifications.filter(n => n.severity !== 'INFO').map(n => `${n.id} · ${n.message}`),
    ...(presentation.value.extrapolation ? [presentation.value.extrapolation.warning] : []),
    ...presentation.value.corrected.flatMap(item => item.status === 'applied' ? [
      ...(item.safetyFactorWarning ? [`${item.title}: ${item.safetyFactorWarning}`] : []),
      ...(item.comparison.status === 'insufficient' ? [`${item.title}: ${item.comparison.summary}`] : []),
    ] : []),
  ])])

  return { pa, temperature, temperatureWarnings, annotationWarnings, extrapolationAcknowledged, corrections, safetyFactors, obstacle, obstacleAssessment, manualConfiguration, showPaErrors, tables, inputKey, compute, presentation }
}
export type PerformanceStep = ReturnType<typeof usePerformanceStep>
