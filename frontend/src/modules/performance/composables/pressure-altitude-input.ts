import { computed, reactive, ref, watch } from 'vue'
import { derivePressureAltitude, type PressureAltitudeDraft } from '@/core/logic/pressure-altitude'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'

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

  const method = ref<PressureAltitudeMethod>('')
  // Kept while the derived method is active so switching back never overwrites it.
  const direct = ref('')
  const draft = reactive<PressureAltitudeDraft>({ qnh: '', qnhUnit: '', elevation: '', elevationUnit: '' })
  const runwayCopy = ref<RunwayCopy | null>(null)
  const notice = ref<string | null>(null)

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
    draft.elevation = copy.text
    draft.elevationUnit = copy.unit
    runwayCopy.value = copy
    notice.value = null
    return true
  }

  // A copied elevation belongs to exactly one saved runway declaration.
  watch(() => savedRunway.value?.savedAt ?? null, (savedAt) => {
    const copy = runwayCopy.value
    if (!copy || savedAt === copy.savedAt) return
    if (copiedFromRunway.value) {
      draft.elevation = ''
      draft.elevationUnit = ''
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

  /** Any change of method, source text, unit or provenance makes prior results stale. */
  const revision = computed(() => JSON.stringify([method.value, direct.value, draft, copiedFromRunway.value]))

  return { method, direct, draft, notice, derivation, savedRunway, copiedFromRunway, elevationProvenance, resolution, revision, useRunwayElevation }
}
