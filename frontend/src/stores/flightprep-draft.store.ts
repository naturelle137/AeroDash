/**
 * Flight Prep Draft Store — P3 App Shell.
 *
 * Keeps the current fuel and performance inputs per aircraft in `localStorage`
 * so a preparation survives reload and offline restart. Every read is
 * validated; anything unreadable is dropped, never partially applied.
 *
 * Key: `aerodash:flightprep:draft` (inside the `aerodash:` erase namespace).
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  CURRENT_FLIGHTPREP_DRAFT_VERSION,
  FlightPrepDraftSchema,
  FlightPrepDraftStoreSchema,
  type FlightPrepDraft,
} from '@/core/domain/flightprep-draft.schema'

const STORAGE_KEY = 'aerodash:flightprep:draft' as const
const DEBOUNCE_MS = 300
/** Bounds the stored size; the least recently saved aircraft is dropped first. */
const MAX_DRAFTS = 50

export const useFlightPrepDraftStore = defineStore('flightPrepDraft', () => {
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Set while the inputs on screen were restored from a stored draft. */
  const restored = ref<{ aircraftId: string; savedAt: string } | null>(null)

  function readAll(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return {}
      const parsed = FlightPrepDraftStoreSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data.drafts
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Unreadable or unavailable storage: start without a draft.
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* best effort */ }
    }
    return {}
  }

  function writeAll(drafts: Record<string, unknown>): void {
    try {
      if (Object.keys(drafts).length === 0) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_FLIGHTPREP_DRAFT_VERSION, drafts }))
    } catch {
      // Quota or unavailable storage: the preparation still works, only persistence is lost.
    }
  }

  /** The validated draft for one aircraft, or null when absent or invalid (an invalid entry is removed). */
  function load(aircraftId: string): FlightPrepDraft | null {
    const drafts = readAll()
    if (!(aircraftId in drafts)) return null
    const parsed = FlightPrepDraftSchema.safeParse(drafts[aircraftId])
    if (parsed.success && parsed.data.aircraftId === aircraftId) return parsed.data
    delete drafts[aircraftId]
    writeAll(drafts)
    return null
  }

  function save(draft: FlightPrepDraft): void {
    const drafts = readAll()
    delete drafts[draft.aircraftId]
    drafts[draft.aircraftId] = draft
    const ids = Object.keys(drafts)
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_DRAFTS))) delete drafts[id]
    writeAll(drafts)
  }

  /** Remove only the stored entry; the on-screen "restored" marker is left alone. */
  function remove(aircraftId: string): void {
    const drafts = readAll()
    if (!(aircraftId in drafts)) return
    delete drafts[aircraftId]
    writeAll(drafts)
  }

  function cancelPendingSave(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  /**
   * Debounced save; `produce` runs when the timer fires so it sees the latest inputs.
   * A null draft (every input back at its default) removes the stored entry.
   */
  function scheduleSave(aircraftId: string, produce: () => FlightPrepDraft | null): void {
    cancelPendingSave()
    timer = setTimeout(() => {
      timer = null
      const draft = produce()
      if (draft) save(draft)
      else remove(aircraftId)
    }, DEBOUNCE_MS)
  }

  function clear(aircraftId: string): void {
    cancelPendingSave()
    remove(aircraftId)
    if (restored.value?.aircraftId === aircraftId) restored.value = null
  }

  return { restored, load, save, scheduleSave, cancelPendingSave, clear }
})
