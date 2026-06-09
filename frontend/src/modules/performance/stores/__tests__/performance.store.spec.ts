// @UT-PF-STORE-001@ (FROM: @IMP-PF-STORE-002@)
// @UT-PF-STORE-002@ (FROM: @IMP-PF-STORE-005@)
// @UT-PF-STORE-003@ (FROM: @IMP-PF-STORE-006@)

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePerformanceStore } from '../performance.store'
import {
  buildPerformanceAircraft,
  WITHIN_ENVELOPE_CONDITIONS,
  EXTRAPOLATED_CONDITIONS,
  BLOCKED_TEMP_CONDITIONS,
} from '../../__tests__/performance-fixtures'

type Store = ReturnType<typeof usePerformanceStore>

function enter(
  store: Store,
  c: { mass: number; pressureAltitude: number; temperature: number },
  available: { takeoff: number; landing: number },
): void {
  store.updateCondition('mass', c.mass)
  store.updateCondition('pressureAltitude', c.pressureAltitude)
  store.updateCondition('temperature', c.temperature)
  store.setAvailable('takeoff', available.takeoff)
  store.setAvailable('landing', available.landing)
}

describe('usePerformanceStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('lifecycle & input completeness', () => {
    it('starts INITIAL', () => {
      const store = usePerformanceStore()
      expect(store.uiState).toBe('INITIAL')
      expect(store.result).toBeNull()
      expect(store.notifications).toEqual([])
    })

    it('is UNCONFIGURED with a profile but incomplete inputs', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      expect(store.uiState).toBe('UNCONFIGURED')
      store.updateCondition('mass', 800)
      store.updateCondition('pressureAltitude', 5000)
      store.updateCondition('temperature', 25)
      store.setAvailable('takeoff', 1200)
      expect(store.uiState).toBe('UNCONFIGURED')
      expect(store.inputsComplete).toBe(false)
    })

    it('custom OSF preset without a multiplier is incomplete', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      store.setOsfPreset('custom')
      expect(store.uiState).toBe('UNCONFIGURED')
      store.setCustomOsf(1.3)
      expect(store.result).not.toBeNull()
    })

    it('clearProfile resets to INITIAL', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      store.clearProfile()
      expect(store.uiState).toBe('INITIAL')
      expect(store.profile).toBeNull()
      expect(store.result).toBeNull()
    })
  })

  describe('POH distances, factors & margin (REQ-PF-004/006/007)', () => {
    it('produces correct base + operational required distances under EASA OSF', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })

      const r = store.result!
      expect(r.base.takeoffRoll).toBeCloseTo(475, 6)
      expect(r.base.takeoffDistance50ft).toBeCloseTo(800, 6)
      expect(r.base.landingRoll).toBeCloseTo(330, 6)
      expect(r.base.landingDistance50ft).toBeCloseTo(600, 6)
      expect(r.takeoff.fullRequired).toBeCloseTo(1000, 6)
      expect(r.landing.fullRequired).toBeCloseTo(858, 6)
    })

    it('GO with absolute + percentage margin when runway is sufficient', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      expect(store.uiState).toBe('GO')
      expect(store.result!.goNoGo).toBe(true)
      expect(store.result!.takeoff.marginAbsolute).toBeCloseTo(200, 6)
      expect(store.result!.takeoff.marginPercent).toBeCloseTo(20, 6)
    })

    it('friction/slope correct only the ground roll; DA/wind the full distance', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 5000, landing: 5000 })
      store.setFactor('friction', 1.2)

      // TOR base 475 → ground roll ×1.2 ×OSF1.25 = 712.5
      expect(store.result!.takeoff.groundRollRequired).toBeCloseTo(712.5, 4)
      // TOD: airborne 325 unaffected by friction; (475×1.2 + 325)×1.25 = 1118.75
      expect(store.result!.takeoff.fullRequired).toBeCloseTo(1118.75, 4)
    })
  })

  describe('CRIT-PF-002 / WARN-PF-002 surfacing (REQ-PF-015/016)', () => {
    it('NO_GO + CRIT-PF-002 when required exceeds available', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 900, landing: 1000 })
      expect(store.uiState).toBe('NO_GO')
      expect(store.notifications.some((n) => n.id === 'CRIT-PF-002')).toBe(true)
      expect(store.hasCriticalNotification).toBe(true)
    })

    it('WARNING + WARN-PF-002 when OSF below the recommended minimum', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 2000, landing: 2000 })
      store.setOsfPreset('custom')
      store.setCustomOsf(1.1)
      expect(store.uiState).toBe('WARNING')
      expect(store.notifications.some((n) => n.id === 'WARN-PF-002')).toBe(true)
    })

    it('poh-afm preset reads the profile factors and clears the WARN', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft({ safetyFactors: { takeoff: 1.5, landing: 1.6 } }))
      store.setOsfPreset('poh-afm')
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 5000, landing: 5000 })
      expect(store.osfInput.pohMandatedFactor).toEqual({ takeoff: 1.5, landing: 1.6 })
      expect(store.result!.takeoff.fullRequired).toBeCloseTo(1200, 6)
      expect(store.notifications.some((n) => n.id === 'WARN-PF-002')).toBe(false)
    })
  })

  describe('extrapolation control (REQ-PF-010/011/012, UJ-C-001)', () => {
    it('PENDING_ACK with +20% penalty and WARN-PF-003 inside the 10% band', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, EXTRAPOLATED_CONDITIONS, { takeoff: 2000, landing: 2000 })
      expect(store.uiState).toBe('PENDING_ACK')
      expect(store.result!.extrapolation.requiresAcknowledgment).toBe(true)
      expect(store.result!.extrapolation.penaltyApplied).toBe(true)
      expect(store.result!.finalized).toBe(false)
      expect(store.awaitingAcknowledgment).toBe(true)
      expect(store.notifications.some((n) => n.id === 'WARN-PF-003')).toBe(true)
    })

    it('acknowledgment finalizes the result; the extrapolation warning persists', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, EXTRAPOLATED_CONDITIONS, { takeoff: 2000, landing: 2000 })
      store.acknowledgeExtrapolation()
      expect(store.result!.finalized).toBe(true)
      expect(store.result!.goNoGo).toBe(true)
      // Finalized, but the standing WARN-PF-003 keeps the state at WARNING.
      expect(store.uiState).toBe('WARNING')
      expect(store.awaitingAcknowledgment).toBe(false)
    })

    it('a later input change re-arms the acknowledgment gate', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, EXTRAPOLATED_CONDITIONS, { takeoff: 2000, landing: 2000 })
      store.acknowledgeExtrapolation()
      store.updateCondition('temperature', 53)
      expect(store.uiState).toBe('PENDING_ACK')
    })

    it('acknowledgeExtrapolation is a no-op when nothing is pending', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      store.acknowledgeExtrapolation()
      expect(store.uiState).toBe('GO')
    })

    it('floors below-envelope conditions at the POH best case without ack (REQ-PF-011)', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, { mass: 800, pressureAltitude: 5000, temperature: -10 }, { takeoff: 2000, landing: 2000 })
      expect(store.result!.extrapolation.benefitCapped).toBe(true)
      expect(store.result!.extrapolation.requiresAcknowledgment).toBe(false)
      // -10 °C floors to the 0 °C POH boundary value (800,5000,0) = 725 m.
      expect(store.result!.base.takeoffDistance50ft).toBeCloseTo(725, 6)
    })

    it('BLOCKED + ERR-PF-001 beyond the 10% temperature cap', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, BLOCKED_TEMP_CONDITIONS, { takeoff: 2000, landing: 2000 })
      expect(store.uiState).toBe('BLOCKED')
      expect(store.result).toBeNull()
      expect(store.notifications.some((n) => n.id === 'ERR-PF-001')).toBe(true)
    })

    it('BLOCKED beyond the altitude cap', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, { mass: 800, pressureAltitude: 11_100, temperature: 25 }, { takeoff: 2000, landing: 2000 })
      expect(store.uiState).toBe('BLOCKED')
    })
  })

  describe('failure surfaces', () => {
    it('rejects a Draft profile (ERR-PF-002)', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft({ status: 'draft' }))
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      expect(store.uiState).toBe('BLOCKED')
      expect(store.notifications.some((n) => n.id === 'ERR-PF-002')).toBe(true)
    })

    it('rejects a profile missing a required POH phase (ERR-PF-002)', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft({ phases: ['TakeoffRoll', 'TakeoffDistance50ft'] }))
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      expect(store.uiState).toBe('BLOCKED')
      expect(store.notifications.some((n) => n.id === 'ERR-PF-002')).toBe(true)
    })

    it('rejects a non-positive correction factor (ERR-SYS-001)', () => {
      const store = usePerformanceStore()
      store.loadProfile(buildPerformanceAircraft())
      enter(store, WITHIN_ENVELOPE_CONDITIONS, { takeoff: 1200, landing: 1000 })
      store.setFactor('friction', 0)
      expect(store.uiState).toBe('BLOCKED')
      expect(store.notifications.some((n) => n.id === 'ERR-SYS-001')).toBe(true)
    })
  })
})
