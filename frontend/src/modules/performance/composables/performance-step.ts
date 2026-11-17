import { computed, ref, shallowRef, watch } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { assessCorrectionSources, profileFacts } from '@/core/logic/performance.correction-sources'
import { SURFACE_CONDITIONS } from '@/core/logic/manual-runway'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'
import { usePressureAltitudeInput } from './pressure-altitude-input'
import { assessPerformance, inspectTables, type MassSource, type PerformanceAssessment } from '../services/poh-inspection'
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
  const ctx = computed(context)

  const profileKey = computed(() => JSON.stringify(ctx.value.profile))
  const inputKey = computed(() => JSON.stringify([
    ctx.value.revision, ctx.value.ready, profileKey.value, ctx.value.category, ctx.value.takeoff, ctx.value.landing,
    pa.revision.value, temperature.value, units.preferences,
    runway.saved, runway.draft, runway.storageError, runway.hasUnsavedChanges,
  ]))
  const result = shallowRef<ComputedResult | null>(null)
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
    if (runway.hasUnsavedChanges) return { status: 'unavailable', reason: 'Manual runway has unsaved changes. Save or discard them to use a current declaration.' }
    const declared = runway.current
    if (!declared) return { status: 'unavailable', reason: 'No saved manual runway declaration.' }
    const { aerodrome, designator, tora, lda, fieldElevation, surface } = declared.record.runway
    const condition = SURFACE_CONDITIONS[surface.type].find((option) => option.value === surface.condition)?.label ?? surface.condition
    const elevationOther = fieldElevation.unit === 'ft' ? `${declared.display.fieldElevationM} m` : `${declared.display.fieldElevationFt} ft`
    return {
      status: 'declared',
      label: `${aerodrome} — runway ${designator}`,
      rows: [
        { label: 'TORA', value: `${tora.value} ${tora.unit} (${declared.display.toraM} m)` },
        { label: 'LDA', value: `${lda.value} ${lda.unit} (${declared.display.ldaM} m)` },
        { label: 'Field elevation', value: `${fieldElevation.value} ${fieldElevation.unit} (${elevationOther})` },
        { label: 'Surface', value: `${surface.type === 'paved' ? 'Paved' : 'Grass / unpaved'} · ${condition}` },
      ],
      note: 'User-entered, not airport-validated. Not compared with the distances; converted available distances are rounded down.',
    }
  })

  const presentation = computed<PerformancePresentation>(() => {
    const { ready, notReadyReason, profile, category, takeoff, landing } = ctx.value
    return presentPerformance({
      inputKey: inputKey.value,
      warnings: pa.warnings.value,
      inputs: [
        { label: 'Pressure altitude method', value: pa.method.value === 'direct' ? 'Direct entry' : pa.method.value === 'qnh-elevation' ? 'Derived from QNH and field elevation' : 'Not selected' },
        ...(pa.method.value === 'direct' ? [{ label: 'Entered pressure altitude', value: `${pa.direct.value.trim() || 'Not entered'} ft` }]
          : pa.method.value === 'qnh-elevation' ? [
            { label: 'QNH', value: `${pa.draft.qnh.trim() || 'Not entered'} ${pa.draft.qnhUnit}` },
            { label: 'Field elevation', value: `${pa.draft.elevation.trim() || 'Not entered'} ${pa.draft.elevationUnit}` },
            { label: 'Field elevation source', value: pa.elevationProvenance.value },
          ] : []),
        { label: 'Outside air temperature', value: `${temperature.value.trim() || 'Not entered'} °C` },
      ],
      aircraft: profile ? { registration: profile.registration, model: `${profile.manufacturer} ${profile.model}`, category } : null,
      takeoff,
      landing,
      assessment: current.value?.assessment ?? null,
      pressureAltitudeBasis: current.value?.basis ?? '',
      pendingReason: !ready ? notReadyReason
        : !profile ? 'Select an aircraft profile.'
          : 'Choose the pressure-altitude method and enter the current conditions.',
      runway: runwayPresentation.value,
      operational: presentOperationalAssessment(ready && profile
        ? assessCorrectionSources(profileFacts(profile, tables.value?.status === 'ready'), runway.current ? {
          label: `${runway.current.record.runway.aerodrome} ${runway.current.record.runway.designator}`,
          surface: runway.current.record.runway.surface,
        } : null) : null, !ready ? notReadyReason : 'Select an aircraft profile.'),
    })
  })

  return { pa, temperature, showPaErrors, tables, inputKey, compute, presentation }
}
export type PerformanceStep = ReturnType<typeof usePerformanceStep>
