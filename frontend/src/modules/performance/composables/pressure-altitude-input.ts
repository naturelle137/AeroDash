import { computed, reactive, ref, watch } from 'vue'
import { QNH_ADVISORY_HPA, derivePressureAltitude, type PressureAltitudeDraft } from '@/core/logic/pressure-altitude'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'
import { convertLengthText, isLengthUnit } from '@/core/logic/unit-preferences'

export type PressureAltitudeMethod = '' | 'direct' | 'qnh-elevation'
export type PressureAltitudeResolution =
  | { status: 'blocked'; message: string }
  | { status: 'ready'; method: 'direct'; value: string }
  | { status: 'ready'; method: 'qnh-elevation'; value: number; displayFt: number }

type RunwayCopy = { text: string; unit: string; savedAt: string; label: string }

/**
 * Orchestrates the pilot's explicit pressure-altitude method. State lives only in the
 * mounting view and is never persisted, so a derived value cannot survive a reload,
 * navigation or local-data erasure. The formula and validation stay in the core.
 */
export function usePressureAltitudeInput() {
  const runway = useManualRunwayStore()
  if (!runway.loaded) runway.load()
  const units = useLoadedUnitPreferences()

  const method = ref<PressureAltitudeMethod>('')
  // Kept while the derived method is active so switching back never overwrites it.
  const direct = ref('')
  // Only units come from preferences; the numbers start blank every session.
  const draft = reactive<PressureAltitudeDraft>({
    qnh: '', qnhUnit: units.preferences.qnh, elevation: '', elevationUnit: units.preferences.fieldElevation,
  })
  const runwayCopy = ref<RunwayCopy | null>(null)
  const notice = ref<string | null>(null)
  let copying = false

  const derivation = computed(() => derivePressureAltitude(draft))
  const copiedFromRunway = computed(() => runwayCopy.value !== null
    && draft.elevation === runwayCopy.value.text && draft.elevationUnit === runwayCopy.value.unit)
  const elevationProvenance = computed(() => copiedFromRunway.value
    ? `Copied by you from the saved manual runway ${runwayCopy.value!.label} (user-entered, not airport-validated).`
    : 'Entered by you.')
  const savedRunway = computed(() => runway.current?.record ?? null)

  function useRunwayElevation(): boolean {
    const record = savedRunway.value
    if (!record) return false
    const { aerodrome, designator, fieldElevation } = record.runway
    const copy = { text: String(fieldElevation.value), unit: fieldElevation.unit, savedAt: record.savedAt, label: `${aerodrome} ${designator}` }
    copying = true
    try {
      draft.elevation = copy.text
      draft.elevationUnit = copy.unit
    } finally {
      copying = false
    }
    runwayCopy.value = copy
    notice.value = null
    return true
  }

  // Changing the unit converts the same physical elevation; a converted copy keeps its runway provenance.
  watch(() => draft.elevationUnit, (to, from) => {
    if (copying || !isLengthUnit(from) || !isLengthUnit(to)) return
    const wasCopied = runwayCopy.value !== null && draft.elevation === runwayCopy.value.text && from === runwayCopy.value.unit
    const converted = convertLengthText(draft.elevation, from, to)
    if (converted === null) return
    draft.elevation = converted
    if (wasCopied) runwayCopy.value = { ...runwayCopy.value!, text: converted, unit: to }
  }, { flush: 'sync' })
  watch(() => units.preferences.fieldElevation, (unit) => {
    if (draft.elevation.trim() === '') draft.elevationUnit = unit
  }, { flush: 'sync' })

  // A copied elevation belongs to exactly one saved runway declaration.
  watch(() => savedRunway.value?.savedAt ?? null, (savedAt) => {
    const copy = runwayCopy.value
    if (!copy || savedAt === copy.savedAt) return
    if (copiedFromRunway.value) {
      draft.elevation = ''
      draft.elevationUnit = units.preferences.fieldElevation
      notice.value = 'The saved manual runway was edited or cleared, so the copied field elevation was removed. Enter or copy it again.'
    }
    runwayCopy.value = null
  }, { flush: 'sync' })

  const resolution = computed<PressureAltitudeResolution>(() => {
    if (method.value === 'direct') return { status: 'ready', method: 'direct', value: direct.value }
    if (method.value !== 'qnh-elevation') {
      return { status: 'blocked', message: 'Choose how pressure altitude is provided: enter it directly, or derive it from QNH and field elevation.' }
    }
    const result = derivation.value
    if (result.status !== 'valid') {
      return { status: 'blocked', message: 'Derived pressure altitude is unavailable. Correct the QNH and field elevation inputs.' }
    }
    return { status: 'ready', method: 'qnh-elevation', value: result.pressureAltitudeFt, displayFt: result.displayPressureAltitudeFt }
  })

  const warnings = computed(() => {
    const result = derivation.value
    return method.value === 'qnh-elevation' && result.status === 'valid' && result.warnings.qnhOutsideAdvisoryRange
      ? [`WARNING WARN-UI-001: QNH ${result.qnh.value} hPa is outside the standard ${QNH_ADVISORY_HPA.min}–${QNH_ADVISORY_HPA.max} hPa range. Check the value.`] : []
  })

  /** Any change of method, source text, unit or provenance makes prior results stale. */
  const revision = computed(() => JSON.stringify([method.value, direct.value, draft, copiedFromRunway.value]))

  return { warnings, method, direct, draft, notice, derivation, savedRunway, copiedFromRunway, elevationProvenance, resolution, revision, useRunwayElevation }
}
