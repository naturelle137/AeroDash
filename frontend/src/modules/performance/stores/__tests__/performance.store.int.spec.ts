// @IT-PF-STORE-001@ (FROM: @IMP-PF-STORE-005@)

// P1 ↔ P2 data-contract handshake: the store orchestrates the real POH-distance,
// extrapolation and safety-factor cores over a schema-validated AircraftProfile
// and projects them to the Go/No-Go view-model. The exhaustive branch coverage
// lives in performance.store.spec.ts; this asserts the end-to-end contract holds
// against the unmocked core (UJ-C-001 numerics included).

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePerformanceStore } from '../performance.store'
import {
  buildPerformanceAircraft,
  WITHIN_ENVELOPE_CONDITIONS,
  EXTRAPOLATED_CONDITIONS,
  BLOCKED_TEMP_CONDITIONS,
} from '../../__tests__/performance-fixtures'

function enter(
  store: ReturnType<typeof usePerformanceStore>,
  c: { mass: number; pressureAltitude: number; temperature: number },
  available: { takeoff: number; landing: number },
): void {
  store.updateCondition('mass', c.mass)
  store.updateCondition('pressureAltitude', c.pressureAltitude)
  store.updateCondition('temperature', c.temperature)
  store.setAvailable('takeoff', available.takeoff)
  store.setAvailable('landing', available.landing)
}

describe('performance store ↔ P1 core (integration)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('produces a GO advisory with the correct margin from real POH math', () => {
    const store = usePerformanceStore()
    store.loadProfile(buildPerformanceAircraft())
    enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })

    expect(store.uiState).toBe('GO')
    expect(store.result!.takeoff.fullRequired).toBeCloseTo(1000, 6)
    expect(store.result!.takeoff.marginAbsolute).toBeCloseTo(200, 6)
  })

  it('raises CRIT-PF-002 and blocks Go when the runway is insufficient', () => {
    const store = usePerformanceStore()
    store.loadProfile(buildPerformanceAircraft())
    enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 900, landing: 1000 })

    expect(store.uiState).toBe('NO_GO')
    expect(store.result!.goNoGo).toBe(false)
    expect(store.notifications.some((n) => n.id === 'CRIT-PF-002')).toBe(true)
  })

  it('gates an extrapolated result behind acknowledgment, then finalizes (UJ-C-001)', () => {
    const store = usePerformanceStore()
    store.loadProfile(buildPerformanceAircraft())
    enter(store, EXTRAPOLATED_CONDITIONS, { takeoff: 2000, landing: 2000 })

    expect(store.uiState).toBe('PENDING_ACK')
    expect(store.result!.finalized).toBe(false)
    store.acknowledgeExtrapolation()
    expect(store.result!.finalized).toBe(true)
    expect(store.result!.goNoGo).toBe(true)
    // Finalized GO advisory, with the extrapolation caution still standing.
    expect(store.uiState).toBe('WARNING')
  })

  it('blocks computation beyond the 10% extrapolation cap (UJ-C-001)', () => {
    const store = usePerformanceStore()
    store.loadProfile(buildPerformanceAircraft())
    enter(store, BLOCKED_TEMP_CONDITIONS, { takeoff: 2000, landing: 2000 })

    expect(store.uiState).toBe('BLOCKED')
    expect(store.result).toBeNull()
    expect(store.notifications.some((n) => n.id === 'ERR-PF-001')).toBe(true)
  })
})
