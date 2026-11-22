import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import {
  EMPTY_MANUAL_RUNWAY_DRAFT,
  SURFACE_CONDITIONS,
  draftFromManualRunway,
  formatNormalizedManualRunway,
  normalizeManualRunway,
  sameManualRunway,
  validateManualRunway,
  type ManualRunwayDraft,
  type ManualRunwayRecord,
} from '@/core/logic/manual-runway'
import { clearManualRunway, loadManualRunway, saveManualRunway } from '../services/manual-runway.repository'
import { loadRecentAirports, saveRecentAirport } from '../services/recent-airports.repository'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'
import { applyPreferredUnit, convertOnLengthUnitChange } from '@/modules/airport/composables/length-unit-conversion'

/** Orchestrates pilot-declared runway inputs; validation and conversion stay in the core. */
export const useManualRunwayStore = defineStore('manualRunway', () => {
  const draft = reactive<ManualRunwayDraft>({ ...EMPTY_MANUAL_RUNWAY_DRAFT })
  const saved = ref<ManualRunwayRecord | null>(null)
  const recent = ref<ManualRunwayRecord[]>([])
  const storageError = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const showErrors = ref(false)
  const loaded = ref(false)
  function useToday(): void {
    const now = new Date()
    assessmentDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  const assessmentDate = ref('')
  useToday()
  const units = useLoadedUnitPreferences()
  const massBalance = useMassBalanceStore()
  let filling = false
  let applyingWeather = false
  let pilotSurfaceChoice = false
  const weather = ref<{ station: string; time: string; liquid: boolean; heavy?: boolean } | null>(null)
  const weatherSurface = ref<NonNullable<ManualRunwayRecord['weatherSurface']> | null>(null)

  const forecast = ref<(NonNullable<ManualRunwayRecord['weatherSurface']> & { liquid: boolean; heavy?: boolean }) | null>(null)
  function updateForecast(value: typeof forecast.value): void { forecast.value = value }

  function updateWeather(value: typeof weather.value): void { weather.value = value }
  watch([weather, forecast, () => draft.aerodrome, () => draft.surfaceType], () => {
    if (weatherSurface.value) {
      applyingWeather = true
      draft.surfaceCondition = ''
      applyingWeather = false
      weatherSurface.value = null
    }
    const station = draft.aerodrome.trim().toUpperCase()
    const candidates = [weather.value, forecast.value].filter(value => value?.station === station)
    const observation = (draft.surfaceType === 'grass' ? candidates.find(value => value?.heavy) : undefined) ?? candidates.find(value => value?.liquid)
    if (!observation || (!observation.liquid && !observation.heavy) || draft.aerodrome.trim().toUpperCase() !== observation.station || draft.surfaceCondition || pilotSurfaceChoice || saved.value) return
    const condition = draft.surfaceType === 'paved' ? 'wet' : draft.surfaceType === 'grass' ? (observation.heavy ? 'soft-ground' : 'wet-grass') : draft.surfaceType === 'unpaved' ? 'wet-unpaved' : ''
    if (!condition) return
    applyingWeather = true
    draft.surfaceCondition = condition
    applyingWeather = false
    const { liquid: _liquid, heavy: _heavy, ...provenance } = observation
    weatherSurface.value = provenance
  }, { flush: 'sync' })
  function chooseSurface(): void { pilotSurfaceChoice = true; weatherSurface.value = null }
  watch(() => draft.surfaceCondition, () => {
    if (!applyingWeather && !filling) { pilotSurfaceChoice = true; weatherSurface.value = null }
  }, { flush: 'sync' })

  const validation = computed(() => validateManualRunway(draft))
  const errors = computed(() => validation.value.status === 'invalid' ? validation.value.errors : {})
  /** Only a saved record identical to the current, valid form is a current declaration. */
  const current = computed(() => {
    if (!saved.value || validation.value.status !== 'valid') return null
    if (!sameManualRunway(saved.value.runway, validation.value.runway)) return null
    const normalized = normalizeManualRunway(saved.value.runway)
    return normalized ? { record: saved.value, display: formatNormalizedManualRunway(normalized) } : null
  })
  const hasUnsavedChanges = computed(() => saved.value !== null && current.value === null)

  // A condition from the other surface family must never survive a type change.
  watch(() => draft.surfaceType, (type) => {
    const options = type === 'paved' || type === 'unpaved' || type === 'grass' ? SURFACE_CONDITIONS[type] : []
    if (!options.some((option) => option.value === draft.surfaceCondition)) draft.surfaceCondition = ''
  }, { flush: 'sync' })
  watch(draft, () => { notice.value = null }, { flush: 'sync' })
  for (const [value, unit] of [['tora', 'toraUnit'], ['lda', 'ldaUnit'], ['toda', 'todaUnit'], ['fieldElevation', 'fieldElevationUnit']] as const) {
    convertOnLengthUnitChange(draft, value, unit, () => filling)
  }
  function applyPreferences(): void {
    const { runwayDistance, fieldElevation } = units.preferences
    applyPreferredUnit(draft, 'tora', 'toraUnit', runwayDistance)
    applyPreferredUnit(draft, 'lda', 'ldaUnit', runwayDistance)
    applyPreferredUnit(draft, 'toda', 'todaUnit', runwayDistance)
    applyPreferredUnit(draft, 'fieldElevation', 'fieldElevationUnit', fieldElevation)
  }
  watch(() => units.preferences, applyPreferences, { flush: 'sync' })

  /** A saved record keeps its own explicit units; only a fresh form takes the preferences. */
  function fill(next: ManualRunwayDraft): void {
    filling = true
    pilotSurfaceChoice = false
    try {
      Object.assign(draft, next)
      applyPreferences()
    } finally {
      filling = false
    }
  }

  function load(): void {
    const result = loadManualRunway()
    recent.value = loadRecentAirports()
    loaded.value = true
    showErrors.value = false
    if (result.status === 'loaded') {
      saved.value = result.record
      storageError.value = null
      fill(draftFromManualRunway(result.record.runway))
    } else {
      saved.value = null
      storageError.value = result.status === 'error' ? result.message : null
      fill({ ...EMPTY_MANUAL_RUNWAY_DRAFT })
    }
    notice.value = null
  }

  const DEMO_BLOCKED = 'Demo / what-if is active: the saved runway cannot be changed. Discard the demo first.'
  // The saved runway is outside the demo; edits made during it are scratch and are dropped afterwards.
  watch(() => massBalance.isDemoActive, (active) => { if (!active && loaded.value) load() }, { flush: 'sync' })

  function save(now = new Date()): boolean {
    if (massBalance.isDemoActive) {
      notice.value = DEMO_BLOCKED
      return false
    }
    showErrors.value = true
    const result = validation.value
    if (result.status !== 'valid') {
      notice.value = null
      return false
    }
    const previous = saved.value
    const provenance = weatherSurface.value ?? (!pilotSurfaceChoice && previous?.runway.aerodrome === result.runway.aerodrome && previous.runway.surface.type === result.runway.surface.type && previous.runway.surface.condition === result.runway.surface.condition ? previous.weatherSurface : undefined)
    const written = saveManualRunway(result.runway, now, provenance)
    if (written.status === 'error') {
      storageError.value = written.message
      return false
    }
    weatherSurface.value = null
    saved.value = written.record
    storageError.value = null
    showErrors.value = false
    fill(draftFromManualRunway(result.runway))
    const history = saveRecentAirport(written.record!)
    if (history) recent.value = history
    notice.value = history ? 'Manual runway inputs saved on this device.' : 'Manual runway inputs saved, but recent airports could not be saved.'
    return true
  }

  function selectRecent(record: ManualRunwayRecord): void {
    if (massBalance.isDemoActive) {
      notice.value = DEMO_BLOCKED
      return
    }
    const written = saveManualRunway(record.runway, new Date(record.savedAt), record.weatherSurface)
    if (written.status === 'error') {
      storageError.value = written.message
      return
    }
    weatherSurface.value = null
    saved.value = written.record
    const history = saveRecentAirport(record)
    if (history) recent.value = history
    storageError.value = null
    showErrors.value = false
    fill(draftFromManualRunway(record.runway))
    notice.value = history ? 'Saved manual runway selected. Verify its source and current conditions.' : 'Runway selected, but recent airports could not be saved. Verify its source and current conditions.'
  }

  function revert(): void {
    if (!saved.value) return
    fill(draftFromManualRunway(saved.value.runway))
    showErrors.value = false
    notice.value = 'Unsaved changes discarded.'
  }

  function clear(): boolean {
    if (massBalance.isDemoActive) {
      notice.value = DEMO_BLOCKED
      return false
    }
    const written = clearManualRunway()
    if (written.status === 'error') {
      storageError.value = written.message
      return false
    }
    saved.value = null
    storageError.value = null
    showErrors.value = false
    fill({ ...EMPTY_MANUAL_RUNWAY_DRAFT })
    notice.value = 'Manual runway inputs cleared from this device.'
    return true
  }

  return { draft, saved, recent, selectRecent, weatherSurface, updateWeather, storageError, notice, showErrors, loaded, assessmentDate, automaticDate, selectAssessmentDate, useToday, validation, errors, current, hasUnsavedChanges, load, save, revert, clear }
})
