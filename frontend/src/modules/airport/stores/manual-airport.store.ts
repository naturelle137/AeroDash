/**
 * Manual Airport Store — Pinia store for the manual airport-entry workflow.
 * P2 Feature Module — orchestrates the airport repository + pure domain logic.
 *
 * Workflow: an ICAO lookup that finds nothing drops into manual-entry mode
 * (REQ-AP-003); the pilot overrides runway parameters (REQ-AP-006) and must
 * select a surface condition (REQ-AP-004) before performance computation is
 * permitted. Online airport auto-population (REQ-AP-002) is deferred, so every
 * lookup currently resolves to manual entry.
 *
 * @see docs/requirements/airport_database.md REQ-AP-003, REQ-AP-004, REQ-AP-006
 */

import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type {
  AirportMode,
  BaseSurfaceType,
  ManualAirportEntry,
  ManualRunwayOverrides,
} from '../domain/airport.types'
import { isValidSurfaceCondition } from '../domain/surface-conditions'
import { evaluateComputeGate, type ComputeGateResult } from '../domain/compute-gate'
import {
  airportRepository,
  MANUAL_AIRPORT_SCHEMA_VERSION,
} from '../services/airport.repository'

/** IndexedDB hydration lifecycle for UI feedback. */
export type AirportLoadState = 'IDLE' | 'LOADING' | 'READY' | 'ERROR'

function blankRunway(): ManualRunwayOverrides {
  return {
    designator: '',
    magneticHeadingDeg: null,
    baseSurfaceType: 'paved',
    slopePercent: null,
    toraM: null,
    todaM: null,
    asdaM: null,
    ldaM: null,
    surfaceConditionId: null,
  }
}

function blankEntry(icao: string): ManualAirportEntry {
  return {
    id: uuidv4(),
    icao,
    name: '',
    elevationFt: null,
    runway: blankRunway(),
    schemaVersion: MANUAL_AIRPORT_SCHEMA_VERSION,
  }
}

// @IMP-AP-STORE-004@ (FROM: @REQ-AP-003@, @REQ-AP-004@, @REQ-AP-006@)
export const useManualAirportStore = defineStore('manual-airport', () => {
  // ─── State ────────────────────────────────────────────────────────────────

  const mode = ref<AirportMode>('idle')
  const entry = ref<ManualAirportEntry | null>(null)
  const savedEntries = ref<ManualAirportEntry[]>([])
  const loadState = ref<AirportLoadState>('IDLE')
  const loadError = ref<string | null>(null)
  /** The last blocked compute attempt, surfaced inline; cleared once the gate passes. */
  const rejection = ref<ComputeGateResult | null>(null)

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Live gate evaluation for the current entry (REQ-AP-004). */
  const gate = computed<ComputeGateResult | null>(() =>
    entry.value ? evaluateComputeGate(entry.value) : null,
  )
  const canCompute = computed<boolean>(() => gate.value?.allowed ?? false)

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * Look up an ICAO code. Online auto-population is deferred, so no match is
   * ever found: the system drops into manual-entry mode with the ICAO
   * pre-filled (REQ-AP-003).
   */
  function searchByIcao(icao: string): void {
    const normalized = icao.trim().toUpperCase()
    entry.value = blankEntry(normalized)
    mode.value = 'manual-entry'
    rejection.value = null
  }

  /** Override airport-level parameters (REQ-AP-006). */
  function updateAirport(changes: Partial<Pick<ManualAirportEntry, 'icao' | 'name' | 'elevationFt'>>): void {
    if (entry.value === null) return
    entry.value = { ...entry.value, ...changes }
    rejection.value = null
  }

  /**
   * Override runway parameters (REQ-AP-006). Changing the base surface type
   * clears a now-incompatible surface condition so an "ice on grass" style
   * mismatch can never survive into the compute gate.
   */
  function updateRunway(changes: Partial<ManualRunwayOverrides>): void {
    if (entry.value === null) return
    const next: ManualRunwayOverrides = { ...entry.value.runway, ...changes }
    if (!isValidSurfaceCondition(next.baseSurfaceType, next.surfaceConditionId)) {
      next.surfaceConditionId = null
    }
    entry.value = { ...entry.value, runway: next }
    rejection.value = null
  }

  /** Select the current surface condition (REQ-AP-004). Invalid ids are coerced to none. */
  function selectSurfaceCondition(id: string | null): void {
    if (entry.value === null) return
    const base: BaseSurfaceType = entry.value.runway.baseSurfaceType
    const accepted = isValidSurfaceCondition(base, id) ? id : null
    entry.value = {
      ...entry.value,
      runway: { ...entry.value.runway, surfaceConditionId: accepted },
    }
    rejection.value = null
  }

  /**
   * Attempt to proceed to performance computation. Returns the gate result and,
   * when blocked, records it as an inline rejection (REQ-AP-004, H-009).
   */
  function requestCompute(): ComputeGateResult {
    const result = gate.value ?? evaluateComputeGate(blankEntry(''))
    rejection.value = result.allowed ? null : result
    return result
  }

  function clearRejection(): void {
    rejection.value = null
  }

  /** Persist the current entry's overrides to IndexedDB (REQ-AP-006). */
  async function saveEntry(): Promise<void> {
    if (entry.value === null) return
    // IndexedDB structured-clone cannot serialise a Vue reactive proxy, so
    // persist (and cache) a plain deep snapshot of the entry instead.
    const snapshot: ManualAirportEntry = structuredClone(toRaw(entry.value))
    await airportRepository.update(snapshot)
    const idx = savedEntries.value.findIndex((e) => e.id === snapshot.id)
    if (idx === -1) savedEntries.value.push(snapshot)
    else savedEntries.value[idx] = snapshot
  }

  /** Hydrate persisted entries from IndexedDB. */
  async function loadAll(): Promise<void> {
    loadState.value = 'LOADING'
    loadError.value = null
    try {
      savedEntries.value = await airportRepository.findAll()
      loadState.value = 'READY'
    } catch (err) {
      loadState.value = 'ERROR'
      loadError.value =
        err instanceof Error ? err.message : 'Failed to load manual airports from storage.'
    }
  }

  /** Discard the current entry and return to the idle search state. */
  function reset(): void {
    entry.value = null
    mode.value = 'idle'
    rejection.value = null
  }

  return {
    // State
    mode,
    entry,
    savedEntries,
    loadState,
    loadError,
    rejection,
    // Getters
    gate,
    canCompute,
    // Actions
    searchByIcao,
    updateAirport,
    updateRunway,
    selectSurfaceCondition,
    requestCompute,
    clearRejection,
    saveEntry,
    loadAll,
    reset,
  }
})
