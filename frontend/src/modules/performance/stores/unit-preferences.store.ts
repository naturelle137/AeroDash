import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  DEFAULT_UNIT_PREFERENCES,
  recoverUnitPreferences,
  type LengthUnit,
  type UnitPreferences,
} from '@/core/logic/unit-preferences'

/** Erased by "Delete all local data" through the shared `aerodash` prefix. */
export const UNIT_PREFERENCES_STORAGE_KEY = 'aerodash.preferences.units.v1'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Persisted display-unit preferences. Only unit choices persist; QNH, pressure
 * altitude and other numeric Performance inputs stay session-only.
 */
export const useUnitPreferencesStore = defineStore('unitPreferences', () => {
  const preferences = ref<UnitPreferences>({ ...DEFAULT_UNIT_PREFERENCES })
  /** `default` until the pilot explicitly saves a choice. */
  const origin = ref<'default' | 'saved'>('default')
  const notice = ref<string | null>(null)
  const loaded = ref(false)

  function load(): void {
    loaded.value = true
    notice.value = null
    let raw: string | null = null
    try {
      const store = storage()
      if (!store) throw new Error('unavailable')
      raw = store.getItem(UNIT_PREFERENCES_STORAGE_KEY)
    } catch {
      notice.value = 'Browser storage is unavailable. Unit preferences use hPa / ft / m and are not saved.'
    }
    const recovered = recoverUnitPreferences(raw)
    if (recovered.status === 'loaded') {
      preferences.value = recovered.preferences
      origin.value = 'saved'
      return
    }
    preferences.value = { ...DEFAULT_UNIT_PREFERENCES }
    origin.value = 'default'
    if (recovered.status === 'invalid') {
      notice.value = 'Saved unit preferences were invalid or unsupported and were not used. Defaults hPa / ft / m apply until you choose again.'
    }
  }

  function set(field: 'fieldElevation' | 'runwayDistance', unit: LengthUnit): void {
    preferences.value = { ...preferences.value, [field]: unit }
    origin.value = 'saved'
    try {
      const store = storage()
      if (!store) throw new Error('unavailable')
      store.setItem(UNIT_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences.value))
      notice.value = null
    } catch {
      notice.value = 'Could not save unit preferences to browser storage. They apply to this page only.'
    }
  }

  return { preferences, origin, notice, loaded, load, set }
})

/** Loads persisted preferences once per app session. */
export function useLoadedUnitPreferences() {
  const store = useUnitPreferencesStore()
  if (!store.loaded) store.load()
  return store
}
