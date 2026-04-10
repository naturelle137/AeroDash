/**
 * Unit tests for FleetList.vue
 * Covers: loading state, empty state, profile list rendering, action buttons,
 * active profile highlighting, Select/Active button state, and delete confirmation.
 *
 * @see frontend/src/modules/aircraft/components/FleetList.vue
 */

// @UT-AC-VIEW-080@ (FROM: @IMP-AC-VIEW-005@, @IMP-AC-VIEW-006@)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { ref } from 'vue'
import FleetList from '../components/FleetList.vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

/** Minimal valid AircraftProfile for testing. */
function makeProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'Draft',
    schemaVersion: 1,
    passengerProfiles: [],
    weighingReports: [{ bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 650,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
    ...overrides,
  }
}

// ─── Store factories (inline stubs for isolation) ──────────────────────────

function makeFleetStore(overrides: {
  isLoading?: boolean
  profiles?: AircraftProfile[]
}) {
  return defineStore('fleet', () => {
    const isLoading = ref(overrides.isLoading ?? false)
    const profiles = ref<AircraftProfile[]>(overrides.profiles ?? [])
    const notifications = ref<unknown[]>([])
    const checkDraftWarning = vi.fn<(p: AircraftProfile) => void>()
    const verifyProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const editVerifiedProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const deleteProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    return { isLoading, profiles, notifications, checkDraftWarning, verifyProfile, editVerifiedProfile, deleteProfile }
  })
}

function makeActiveStore(activeProfile: AircraftProfile | null = null) {
  return defineStore('activeAircraft', () => {
    const active = ref<AircraftProfile | null>(activeProfile)
    const setActiveProfile = vi.fn<(p: AircraftProfile) => void>((p: AircraftProfile) => { active.value = p })
    const clearActive = vi.fn<() => void>()
    return { activeProfile: active, setActiveProfile, clearActive }
  })
}

function mountFleetList(options: {
  isLoading?: boolean
  profiles?: AircraftProfile[]
  activeProfile?: AircraftProfile | null
}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  makeFleetStore({ isLoading: options.isLoading, profiles: options.profiles })()
  makeActiveStore(options.activeProfile ?? null)()
  return mount(FleetList, { global: { plugins: [pinia] } })
}

describe('FleetList — loading state', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-080@ (FROM: @IMP-AC-VIEW-005@)
  it('shows loading message when isLoading is true', () => {
    const wrapper = mountFleetList({ isLoading: true, profiles: [] })
    expect(wrapper.text()).toContain('Loading fleet')
  })
})

describe('FleetList — empty state', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-081@ (FROM: @IMP-AC-VIEW-005@)
  it('shows empty-state message when no profiles exist', () => {
    const wrapper = mountFleetList({ profiles: [] })
    expect(wrapper.text()).toContain('No aircraft profiles')
  })

  // @UT-AC-VIEW-082@ (FROM: @IMP-AC-VIEW-005@)
  it('does not render the profiles list when empty', () => {
    const wrapper = mountFleetList({ profiles: [] })
    expect(wrapper.find('.profiles-list').exists()).toBe(false)
  })
})

describe('FleetList — profile list rendering', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-083@ (FROM: @IMP-AC-VIEW-005@)
  it('renders a list item for each profile', () => {
    const profiles = [
      makeProfile({ id: 'p1', registration: 'D-EBPN' }),
      makeProfile({ id: 'p2', registration: 'G-ABCD' }),
    ]
    const wrapper = mountFleetList({ profiles })
    const items = wrapper.findAll('.profile-item')
    expect(items).toHaveLength(2)
  })

  // @UT-AC-VIEW-084@ (FROM: @IMP-AC-VIEW-005@)
  it('displays registration and model for each profile', () => {
    const profile = makeProfile({ registration: 'D-EBPN', manufacturer: 'Tecnam', model: 'P2008 JC' })
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.text()).toContain('D-EBPN')
    expect(wrapper.text()).toContain('Tecnam P2008 JC')
  })

  // @UT-AC-VIEW-085@ (FROM: @IMP-AC-VIEW-005@)
  it('shows ProfileStatusBadge for each profile', () => {
    const profile = makeProfile({ status: 'Draft' })
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.profile-status-badge').exists()).toBe(true)
  })
})

describe('FleetList — active profile highlighting', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-086@ (FROM: @IMP-AC-VIEW-006@)
  it('applies active CSS class to the active profile item', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })
    expect(wrapper.find('.profile-item--active').exists()).toBe(true)
  })

  // @UT-AC-VIEW-087@ (FROM: @IMP-AC-VIEW-006@)
  it('does not apply active CSS class when no active profile', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: null })
    expect(wrapper.find('.profile-item--active').exists()).toBe(false)
  })
})

describe('FleetList — action buttons', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-088@ (FROM: @IMP-AC-VIEW-006@)
  it('Select button is disabled when profile is already active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toBe('Active')
  })

  // @UT-AC-VIEW-089@ (FROM: @IMP-AC-VIEW-006@)
  it('Select button is enabled when profile is not active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: null })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.text()).toBe('Select')
  })

  // @UT-AC-VIEW-090@ (FROM: @IMP-AC-VIEW-006@)
  it('shows Verify button only for Draft profiles', () => {
    const draft = makeProfile({ status: 'Draft' })
    const wrapper = mountFleetList({ profiles: [draft] })
    expect(wrapper.find('.btn-success').exists()).toBe(true)
  })

  // @UT-AC-VIEW-091@ (FROM: @IMP-AC-VIEW-006@)
  it('shows Edit button only for Verified profiles', () => {
    const verified = makeProfile({ status: 'Verified' })
    const wrapper = mountFleetList({ profiles: [verified] })
    expect(wrapper.find('.btn-secondary').exists()).toBe(true)
    expect(wrapper.find('.btn-success').exists()).toBe(false)
  })

  // @UT-AC-VIEW-092@ (FROM: @IMP-AC-VIEW-006@)
  it('always shows Delete button for each profile', () => {
    const profile = makeProfile()
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.btn-danger').exists()).toBe(true)
  })
})
