/**
 * Unit tests for FleetList.vue
 * Covers: loading state, empty state, profile list rendering, action buttons,
 * active profile highlighting, Select/Active button state, and delete confirmation.
 *
 * @see frontend/src/modules/aircraft/components/FleetList.vue
 */

// @UT-AC-VIEW-080@ (FROM: @IMP-AC-VIEW-005@, @IMP-AC-VIEW-006@)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { ref } from 'vue'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import FleetList from '../components/FleetList.vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// UX-001: the undo path re-creates the deleted record via the repository, then
// rehydrates the store. Mock the repository so no test touches IndexedDB.
vi.mock('../services/fleet.repository', () => ({
  fleetRepository: {
    create: vi.fn<(p: AircraftProfile) => Promise<void>>().mockResolvedValue(undefined),
    findAll: vi.fn<() => Promise<AircraftProfile[]>>().mockResolvedValue([]),
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteById: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findById: vi.fn<() => Promise<AircraftProfile | undefined>>().mockResolvedValue(undefined),
    openDB: vi.fn<() => Promise<unknown>>(),
  },
}))

import { fleetRepository } from '../services/fleet.repository'

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
    status: 'draft',
    schemaVersion: 1,
    powertrain: 'combustion',
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
    const fleetLoadState = ref<'LOADING' | 'READY' | 'ERROR'>(
      overrides.isLoading ? 'LOADING' : 'READY',
    )
    const fleetLoadError = ref<string | null>(null)
    const profiles = ref<AircraftProfile[]>(overrides.profiles ?? [])
    const notifications = ref<unknown[]>([])
    const checkDraftWarning = vi.fn<(p: AircraftProfile) => void>()
    const verifyProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const editVerifiedProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const deleteProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const loadAll = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    return {
      isLoading,
      fleetLoadState,
      fleetLoadError,
      profiles,
      notifications,
      checkDraftWarning,
      verifyProfile,
      editVerifiedProfile,
      deleteProfile,
      loadAll,
    }
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

function makeRouter(): Router {
  const router = createRouter({
    history: createMemoryHistory('/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
      { path: '/fleet/:id/edit', name: 'fleet-edit', component: { template: '<div />' } },
    ],
  })
  return router
}

function mountFleetList(options: {
  isLoading?: boolean
  profiles?: AircraftProfile[]
  activeProfile?: AircraftProfile | null
  router?: Router
}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  makeFleetStore({ isLoading: options.isLoading, profiles: options.profiles })()
  makeActiveStore(options.activeProfile ?? null)()
  const router = options.router ?? makeRouter()
  router.push('/fleet')
  return mount(FleetList, { global: { plugins: [pinia, router] } })
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
    const profile = makeProfile({ status: 'draft' })
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
  it('Select button is disabled and aria-pressed=true when profile is already active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(btn.attributes('aria-label')).toContain('active aircraft')
    expect(btn.text()).toContain('Active')
  })

  // @UT-AC-VIEW-089@ (FROM: @IMP-AC-VIEW-006@)
  it('Select button is enabled and aria-pressed=false when profile is not active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: null })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(btn.attributes('aria-label')).toContain('Select')
    expect(btn.text()).toContain('Select')
  })

  // @UT-AC-VIEW-090@ (FROM: @IMP-AC-VIEW-006@)
  it('shows Verify button only for Draft profiles', () => {
    const draft = makeProfile({ status: 'draft' })
    const wrapper = mountFleetList({ profiles: [draft] })
    expect(wrapper.find('.btn-success').exists()).toBe(true)
  })

  // @UT-AC-VIEW-091@ (FROM: @IMP-AC-VIEW-006@)
  it('shows Edit button for both Draft and Verified profiles', () => {
    const verified = makeProfile({ id: 'v1', status: 'verified' })
    const draft = makeProfile({ id: 'd1', status: 'draft' })
    const wrapperV = mountFleetList({ profiles: [verified] })
    expect(wrapperV.find('.btn-secondary').exists()).toBe(true)
    expect(wrapperV.find('.btn-success').exists()).toBe(false)
    const wrapperD = mountFleetList({ profiles: [draft] })
    expect(wrapperD.find('.btn-secondary').exists()).toBe(true)
  })

  // @UT-AC-VIEW-093@ (FROM: @IMP-AC-VIEW-006@, @IMP-UI-ROUTE-002@)
  it('navigates to fleet-edit route when Edit is clicked', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    const profile = makeProfile({ id: 'p-nav-1', status: 'verified' })
    const wrapper = mountFleetList({ profiles: [profile], router })
    await wrapper.find('.btn-secondary').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'fleet-edit', params: { id: 'p-nav-1' } })
  })

  // @UT-AC-VIEW-092@ (FROM: @IMP-AC-VIEW-006@)
  it('always shows Delete button for each profile', () => {
    const profile = makeProfile()
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.btn-danger').exists()).toBe(true)
  })

  // @UT-AC-VIEW-094@ (FROM: @IMP-AC-VIEW-006@, @IMP-AC-STORE-004@)
  it('always shows Download button for each profile', () => {
    const profile = makeProfile()
    const wrapper = mountFleetList({ profiles: [profile] })
    const downloadBtn = wrapper.find('.btn-download')
    expect(downloadBtn.exists()).toBe(true)
    expect(downloadBtn.attributes('aria-label')).toContain(profile.registration)
  })

  // @UT-AC-VIEW-095@ (FROM: @IMP-AC-VIEW-006@)
  it('icon buttons expose an aria-label referencing the registration', () => {
    const profile = makeProfile({ registration: 'D-EBPN', status: 'draft' })
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.btn-primary').attributes('aria-label')).toContain('D-EBPN')
    expect(wrapper.find('.btn-success').attributes('aria-label')).toContain('D-EBPN')
    expect(wrapper.find('.btn-secondary').attributes('aria-label')).toContain('D-EBPN')
    expect(wrapper.find('.btn-danger').attributes('aria-label')).toContain('D-EBPN')
    expect(wrapper.find('.btn-download').attributes('aria-label')).toContain('D-EBPN')
  })
})

describe('FleetList — download action', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  // @UT-AC-VIEW-096@ (FROM: @IMP-AC-VIEW-006@, @IMP-AC-STORE-004@)
  it('clicking the download icon triggers a blob URL + anchor click', async () => {
    const createObjectURL = vi.fn<(arg: Blob) => string>(() => 'blob:test')
    const revokeObjectURL = vi.fn<(url: string) => void>()
    const originalCreate = globalThis.URL.createObjectURL
    const originalRevoke = globalThis.URL.revokeObjectURL
    globalThis.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const profile = makeProfile({ id: 'dl-1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })
    await wrapper.find('.btn-download').trigger('click')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')

    clickSpy.mockRestore()
    globalThis.URL.createObjectURL = originalCreate
    globalThis.URL.revokeObjectURL = originalRevoke
  })
})

// ─── UX-001: confirm-then-undo destructive delete ──────────────────────────

describe('FleetList — delete confirmation + undo (UX-001)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    // ConfirmDialog + UndoToast teleport into <body>; clean between tests.
    document.body.innerHTML = ''
  })

  // @UT-AC-VIEW-165@ (FROM: @IMP-AC-VIEW-019@)
  it('does not use the native window.confirm() when deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    await wrapper.find('.btn-danger').trigger('click')

    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  // @UT-AC-VIEW-166@ (FROM: @IMP-AC-VIEW-019@)
  it('opens an in-app confirmation dialog naming the aircraft on delete tap', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    expect(document.querySelector('.confirm-dialog')).toBeNull()
    await wrapper.find('.btn-danger').trigger('click')

    const dialog = document.querySelector('.confirm-dialog')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('D-EBPN')
  })

  // @UT-AC-VIEW-167@ (FROM: @IMP-AC-VIEW-019@)
  it('does not delete (no undo toast) when the confirmation is cancelled', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    await wrapper.find('.btn-danger').trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--cancel') as HTMLButtonElement).click()
    await flushPromises()

    // No delete happened → the undo affordance never opens and the dialog closes.
    expect(document.querySelector('.undo-toast')).toBeNull()
    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })

  // @UT-AC-VIEW-168@ (FROM: @IMP-AC-VIEW-019@)
  it('deletes and shows an undo toast when the confirmation is accepted', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    await wrapper.find('.btn-danger').trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement).click()
    await flushPromises()

    const toast = document.querySelector('.undo-toast')
    expect(toast).not.toBeNull()
    expect(toast?.textContent).toContain('D-EBPN')
  })

  // @UT-AC-VIEW-169@ (FROM: @IMP-AC-VIEW-019@)
  it('restores the deleted profile via the repository when undo is tapped', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    await wrapper.find('.btn-danger').trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement).click()
    await flushPromises()
    ;(document.querySelector('.undo-toast__action') as HTMLButtonElement).click()
    await flushPromises()

    expect(fleetRepository.create).toHaveBeenCalledWith(profile)
  })

  // @UT-AC-VIEW-170@ (FROM: @IMP-AC-VIEW-019@)
  it('disables the delete control while the profile is the active aircraft', () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })

    const deleteBtn = wrapper.find('.btn-danger')
    expect(deleteBtn.attributes('disabled')).toBeDefined()
    expect(deleteBtn.attributes('aria-label')).toContain('active aircraft')
  })

  // @UT-AC-VIEW-171@ (FROM: @IMP-AC-VIEW-019@)
  it('does not open the confirmation for the active aircraft (defence in depth)', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })

    // The DOM button is disabled; call the handler directly to prove the guard.
    ;(wrapper.vm as unknown as { onDelete(p: AircraftProfile): void }).onDelete(profile)
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })
})
