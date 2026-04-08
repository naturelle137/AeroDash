/**
 * Session Persistence Store — P3 App Shell.
 *
 * Watches the Mass & Balance store and serialises the pilot's entered preflight
 * data to `localStorage` on each change (debounced).  On app start the saved
 * payload is validated and returned to the caller for restoration.
 *
 * Key: `aerodash:session:payload`
 *
 * Invariants:
 *  - An invalid or missing payload → clean session (no pre-population).
 *  - Aircraft switch → prior payload immediately cleared.
 *  - Saves are debounced to avoid writing on every keystroke.
 *  - Restored data is validated with Zod before returning to callers.
 *
 * @see docs/architecture/frontend_state_machine.md
 */

import { defineStore } from 'pinia'
import { watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { SessionPayloadSchema, type SessionPayload } from '@/core/domain/session.schema'

// @IMP-SYS-STORE-001@ (FROM: @REQ-SYS-013@)

const STORAGE_KEY = 'aerodash:session:payload' as const
const DEBOUNCE_MS = 300

export const useSessionPersistenceStore = defineStore('sessionPersistence', () => {
  // ── Private state ─────────────────────────────────────────────────────────

  let _debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Immediately serialise the current M&B store state to `localStorage`.
   * No-op when no aircraft profile is loaded.
   */
  function saveSession(): void {
    const mbStore = useMassBalanceStore()
    if (!mbStore.aircraft || !mbStore.activeCategory) {
      return
    }

    const payload: SessionPayload = {
      version: 1,
      aircraftId: mbStore.aircraft.id,
      activeCategory: mbStore.activeCategory,
      stations: mbStore.stations.map((s) => ({
        index: s.index,
        weight: s.weight,
        touched: s.touched,
        verified: s.verified,
      })),
      savedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Storage quota exceeded or unavailable — fail silently; the pilot can
      // still operate, they just lose auto-save for this session.
    }
  }

  /**
   * Schedule a debounced save.  Clears any pending timer before setting a new one.
   */
  function _scheduleSave(): void {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
    }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      saveSession()
    }, DEBOUNCE_MS)
  }

  /**
   * Remove any persisted payload from `localStorage`.
   * Called on aircraft switch or explicit session reset.
   */
  function clearSession(): void {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors — clearing is best-effort.
    }
  }

  /**
   * Read, validate, and return the persisted session payload.
   *
   * Returns `null` when:
   *  - `localStorage` is empty or the key is absent.
   *  - The stored JSON fails Zod validation (schema mismatch / corruption).
   *
   * An invalid payload is removed from storage so it does not persist across
   * future page loads.
   */
  function restoreSession(): SessionPayload | null {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }

    if (raw === null) {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      clearSession()
      return null
    }

    const result = SessionPayloadSchema.safeParse(parsed)
    if (!result.success) {
      clearSession()
      return null
    }

    return result.data
  }

  // ── Watchers ──────────────────────────────────────────────────────────────

  /**
   * Watch station weights and active category; schedule a debounced save on
   * any change.  Uses a lazy watch so the initial state is not saved before
   * the aircraft profile has been fully loaded.
   */
  function startWatching(): void {
    const mbStore = useMassBalanceStore()

    // Watch for aircraft switch → clear prior session data.
    watch(
      () => mbStore.aircraft?.id,
      (newId, oldId) => {
        if (oldId !== undefined && newId !== oldId) {
          clearSession()
        }
      },
    )

    // Watch station weights and category → debounced save.
    watch(
      () => ({
        stations: mbStore.stations.map((s) => ({ index: s.index, weight: s.weight, touched: s.touched, verified: s.verified })),
        activeCategory: mbStore.activeCategory,
      }),
      () => {
        if (mbStore.aircraft) {
          _scheduleSave()
        }
      },
      { deep: true },
    )
  }

  return {
    saveSession,
    clearSession,
    restoreSession,
    startWatching,
  }
})
