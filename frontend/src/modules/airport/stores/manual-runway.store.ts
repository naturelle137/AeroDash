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

/** Orchestrates pilot-declared runway inputs; validation and conversion stay in the core. */
export const useManualRunwayStore = defineStore('manualRunway', () => {
  const draft = reactive<ManualRunwayDraft>({ ...EMPTY_MANUAL_RUNWAY_DRAFT })
  const saved = ref<ManualRunwayRecord | null>(null)
  const storageError = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const showErrors = ref(false)
  const loaded = ref(false)

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
    const options = type === 'paved' || type === 'unpaved' ? SURFACE_CONDITIONS[type] : []
    if (!options.some((option) => option.value === draft.surfaceCondition)) draft.surfaceCondition = ''
  }, { flush: 'sync' })
  watch(draft, () => { notice.value = null }, { flush: 'sync' })

  function fill(next: ManualRunwayDraft): void {
    Object.assign(draft, next)
  }

  function load(): void {
    const result = loadManualRunway()
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

  function save(now = new Date()): boolean {
    showErrors.value = true
    const result = validation.value
    if (result.status !== 'valid') {
      notice.value = null
      return false
    }
    const written = saveManualRunway(result.runway, now)
    if (written.status === 'error') {
      storageError.value = written.message
      return false
    }
    saved.value = written.record
    storageError.value = null
    showErrors.value = false
    fill(draftFromManualRunway(result.runway))
    notice.value = 'Manual runway inputs saved on this device.'
    return true
  }

  function revert(): void {
    if (!saved.value) return
    fill(draftFromManualRunway(saved.value.runway))
    showErrors.value = false
    notice.value = 'Unsaved changes discarded.'
  }

  function clear(): boolean {
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

  return { draft, saved, storageError, notice, showErrors, loaded, validation, errors, current, hasUnsavedChanges, load, save, revert, clear }
})
