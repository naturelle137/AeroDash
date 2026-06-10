// @UT-AP-STORE-003@ (FROM: @IMP-AP-STORE-004@)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/airport.repository', () => ({
  MANUAL_AIRPORT_SCHEMA_VERSION: 1,
  airportRepository: {
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findAll: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  },
}))

import { airportRepository } from '../../services/airport.repository'
import { useManualAirportStore } from '../manual-airport.store'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('searchByIcao (REQ-AP-003)', () => {
  it('drops into manual-entry mode with the normalized ICAO when nothing is found', () => {
    const store = useManualAirportStore()
    store.searchByIcao(' zzzz ')
    expect(store.mode).toBe('manual-entry')
    expect(store.entry?.icao).toBe('ZZZZ')
  })

  it('starts a fresh entry with no surface condition selected', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    expect(store.entry?.runway.surfaceConditionId).toBeNull()
    expect(store.canCompute).toBe(false)
  })
})

describe('airport-level overrides (REQ-AP-006)', () => {
  it('applies name and elevation overrides to the current entry', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateAirport({ name: 'Family Strip', elevationFt: 350 })
    expect(store.entry?.name).toBe('Family Strip')
    expect(store.entry?.elevationFt).toBe(350)
  })

  it('ignores airport overrides when there is no active entry', () => {
    const store = useManualAirportStore()
    store.updateAirport({ name: 'Nowhere' })
    expect(store.entry).toBeNull()
  })
})

describe('override editing (REQ-AP-006)', () => {
  it('applies runway overrides to the current entry', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ toraM: 600, designator: '27' })
    expect(store.entry?.runway.toraM).toBe(600)
    expect(store.entry?.runway.designator).toBe('27')
  })

  it('ignores overrides when there is no active entry', () => {
    const store = useManualAirportStore()
    store.updateRunway({ toraM: 600 })
    expect(store.entry).toBeNull()
  })

  it('clears an incompatible surface condition when the base surface type changes', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ baseSurfaceType: 'grass' })
    store.selectSurfaceCondition('grass-long')
    store.updateRunway({ baseSurfaceType: 'paved' })
    expect(store.entry?.runway.surfaceConditionId).toBeNull()
  })
})

describe('selectSurfaceCondition (REQ-AP-004)', () => {
  it('accepts a condition valid for the current base surface type', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.selectSurfaceCondition('paved-wet')
    expect(store.entry?.runway.surfaceConditionId).toBe('paved-wet')
  })

  it('coerces an invalid cross-surface selection to none', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.selectSurfaceCondition('grass-long')
    expect(store.entry?.runway.surfaceConditionId).toBeNull()
  })
})

describe('requestCompute gate (REQ-AP-004, H-009)', () => {
  it('blocks and records an inline rejection when the surface condition is missing', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ toraM: 600 })
    const result = store.requestCompute()
    expect(result.allowed).toBe(false)
    expect(store.rejection?.blockers).toContain('SURFACE_CONDITION_REQUIRED')
  })

  it('passes and clears the rejection once a valid condition and length are set', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ toraM: 600 })
    store.requestCompute()
    store.selectSurfaceCondition('paved-dry')
    const result = store.requestCompute()
    expect(result.allowed).toBe(true)
    expect(store.rejection).toBeNull()
    expect(store.canCompute).toBe(true)
  })

  it('blocks compute when there is no active entry at all', () => {
    const store = useManualAirportStore()
    const result = store.requestCompute()
    expect(result.allowed).toBe(false)
    expect(store.rejection?.allowed).toBe(false)
  })

  it('clears a standing rejection on demand', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.requestCompute()
    expect(store.rejection).not.toBeNull()
    store.clearRejection()
    expect(store.rejection).toBeNull()
  })
})

describe('persistence + lifecycle', () => {
  it('persists the current entry via the repository (REQ-AP-006)', async () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ toraM: 600 })
    await store.saveEntry()
    expect(airportRepository.update).toHaveBeenCalledOnce()
    expect(store.savedEntries).toHaveLength(1)
  })

  it('replaces the cached entry in place when the same runway is saved twice', async () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateRunway({ toraM: 600 })
    await store.saveEntry()
    store.updateRunway({ toraM: 720 })
    await store.saveEntry()
    expect(store.savedEntries).toHaveLength(1)
    expect(store.savedEntries[0]?.runway.toraM).toBe(720)
  })

  it('does nothing when saving with no active entry', async () => {
    const store = useManualAirportStore()
    await store.saveEntry()
    expect(airportRepository.update).not.toHaveBeenCalled()
    expect(store.savedEntries).toHaveLength(0)
  })

  it('hydrates saved entries on loadAll', async () => {
    const store = useManualAirportStore()
    await store.loadAll()
    expect(airportRepository.findAll).toHaveBeenCalledOnce()
    expect(store.loadState).toBe('READY')
  })

  it('reports an error state when hydration fails', async () => {
    vi.mocked(airportRepository.findAll).mockRejectedValueOnce(new Error('boom'))
    const store = useManualAirportStore()
    await store.loadAll()
    expect(store.loadState).toBe('ERROR')
    expect(store.loadError).toBe('boom')
  })

  it('resets back to the idle search state', () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.reset()
    expect(store.mode).toBe('idle')
    expect(store.entry).toBeNull()
  })
})
