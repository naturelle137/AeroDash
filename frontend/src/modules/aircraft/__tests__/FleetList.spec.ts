/**
 * Unit tests for FleetList.vue
 * Covers: loading state, empty state, profile list rendering, action buttons,
 * active profile highlighting, Select/Active button state, and delete confirmation.
 *
 * @see frontend/src/modules/aircraft/components/FleetList.vue
 */


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { ref } from 'vue'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import FleetList from '../components/FleetList.vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// the undo path re-creates the deleted record via the repository, then
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
    const reverifyProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
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
      reverifyProfile,
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

  it('shows loading message when isLoading is true', () => {
    const wrapper = mountFleetList({ isLoading: true, profiles: [] })
    expect(wrapper.text()).toContain('Loading fleet')
  })
})

describe('FleetList — empty state', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('shows empty-state message when no profiles exist', () => {
    const wrapper = mountFleetList({ profiles: [] })
    expect(wrapper.text()).toContain('No aircraft profiles')
  })

  it('does not render the profiles list when empty', () => {
    const wrapper = mountFleetList({ profiles: [] })
    expect(wrapper.find('.profiles-list').exists()).toBe(false)
  })
})

describe('FleetList — profile list rendering', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders a list item for each profile', () => {
    const profiles = [
      makeProfile({ id: 'p1', registration: 'D-EBPN' }),
      makeProfile({ id: 'p2', registration: 'G-ABCD' }),
    ]
    const wrapper = mountFleetList({ profiles })
    const items = wrapper.findAll('.profile-item')
    expect(items).toHaveLength(2)
  })

  it('displays registration and model for each profile', () => {
    const profile = makeProfile({ registration: 'D-EBPN', manufacturer: 'Tecnam', model: 'P2008 JC' })
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.text()).toContain('D-EBPN')
    expect(wrapper.text()).toContain('Tecnam P2008 JC')
  })

  it('shows ProfileStatusBadge for each profile', () => {
    const profile = makeProfile({ status: 'draft' })
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.profile-status-badge').exists()).toBe(true)
  })
})

describe('FleetList — active profile highlighting', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('applies active CSS class to the active profile item', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })
    expect(wrapper.find('.profile-item--active').exists()).toBe(true)
  })

  it('does not apply active CSS class when no active profile', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: null })
    expect(wrapper.find('.profile-item--active').exists()).toBe(false)
  })
})

describe('FleetList — action buttons', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('Select button is disabled and aria-pressed=true when profile is already active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(btn.attributes('aria-label')).toContain('active aircraft')
    expect(btn.text()).toContain('Active')
  })

  it('Select button is enabled and aria-pressed=false when profile is not active', () => {
    const profile = makeProfile({ id: 'p1' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: null })
    const btn = wrapper.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(btn.attributes('aria-label')).toContain('Select')
    expect(btn.text()).toContain('Select')
  })

  it('shows Verify button only for Draft profiles', () => {
    const draft = makeProfile({ status: 'draft' })
    const wrapper = mountFleetList({ profiles: [draft] })
    expect(wrapper.find('.btn-success').exists()).toBe(true)
  })

  it('shows Edit button for both Draft and Verified profiles', () => {
    const verified = makeProfile({ id: 'v1', status: 'verified' })
    const draft = makeProfile({ id: 'd1', status: 'draft' })
    const wrapperV = mountFleetList({ profiles: [verified] })
    expect(wrapperV.find('.btn-secondary').exists()).toBe(true)
    expect(wrapperV.find('.btn-success').exists()).toBe(false)
    const wrapperD = mountFleetList({ profiles: [draft] })
    expect(wrapperD.find('.btn-secondary').exists()).toBe(true)
  })

  it('navigates to fleet-edit route when Edit is clicked', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    const profile = makeProfile({ id: 'p-nav-1', status: 'verified' })
    const wrapper = mountFleetList({ profiles: [profile], router })
    await wrapper.find('.btn-secondary').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'fleet-edit', params: { id: 'p-nav-1' } })
  })

  it('always shows Delete button for each profile', () => {
    const profile = makeProfile()
    const wrapper = mountFleetList({ profiles: [profile] })
    expect(wrapper.find('.btn-danger').exists()).toBe(true)
  })

  it('always shows Download button for each profile', () => {
    const profile = makeProfile()
    const wrapper = mountFleetList({ profiles: [profile] })
    const downloadBtn = wrapper.find('.btn-download')
    expect(downloadBtn.exists()).toBe(true)
    expect(downloadBtn.attributes('aria-label')).toContain(profile.registration)
  })

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

// ─── confirm-then-undo destructive delete ─────────────────────────────────

describe('FleetList — delete confirmation + undo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    // ConfirmDialog + UndoToast teleport into <body>; clean between tests.
    document.body.innerHTML = ''
  })

  it('does not use the native window.confirm() when deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    await wrapper.find('.btn-danger').trigger('click')

    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('opens an in-app confirmation dialog naming the aircraft on delete tap', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile] })

    expect(document.querySelector('.confirm-dialog')).toBeNull()
    await wrapper.find('.btn-danger').trigger('click')

    const dialog = document.querySelector('.confirm-dialog')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('D-EBPN')
  })

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

  it('disables the delete control while the profile is the active aircraft', () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })

    const deleteBtn = wrapper.find('.btn-danger')
    expect(deleteBtn.attributes('disabled')).toBeDefined()
    expect(deleteBtn.attributes('aria-label')).toContain('active aircraft')
  })

  it('does not open the confirmation for the active aircraft (defence in depth)', async () => {
    const profile = makeProfile({ id: 'p1', registration: 'D-EBPN' })
    const wrapper = mountFleetList({ profiles: [profile], activeProfile: profile })

    // The DOM button is disabled; call the handler directly to prove the guard.
    ;(wrapper.vm as unknown as { onDelete(p: AircraftProfile): void }).onDelete(profile)
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })
})

// ─── REQ-AC-007: verification provenance + expiry display ───────────────────

describe('FleetList — verification provenance + expiry (REQ-AC-007)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  /** Mount FleetList, returning both the wrapper and the (stub) fleet store. */
  function mountWithStore(profiles: AircraftProfile[]) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const fleet = makeFleetStore({ profiles })()
    makeActiveStore(null)()
    const router = makeRouter()
    router.push('/fleet')
    const wrapper = mount(FleetList, { global: { plugins: [pinia, router] } })
    return { wrapper, fleet }
  }

  const today = new Date().toISOString().slice(0, 10)

  it('shows the verify dialog when the Verify button is tapped on a Draft', async () => {
    const { wrapper } = mountWithStore([makeProfile({ status: 'draft' })])
    expect(document.querySelector('.verify-dialog')).toBeNull()

    await wrapper.find('.btn-verify').trigger('click')

    expect(document.querySelector('.verify-dialog')).not.toBeNull()
  })

  it('verifies a Draft with the captured sign-off provenance', async () => {
    const { wrapper, fleet } = mountWithStore([makeProfile({ id: 'd1', status: 'draft' })])
    const verifySpy = vi.spyOn(fleet, 'verifyProfile')
    await wrapper.find('.btn-verify').trigger('click')

    ;(
      wrapper.vm as unknown as {
        onConfirmVerify(s: { verifiedBy: string; pohRevision: string; verifiedOn: string }): void
      }
    ).onConfirmVerify({ verifiedBy: 'JS', pohRevision: 'Rev 7', verifiedOn: '2026-05-01' })
    await flushPromises()

    expect(verifySpy).toHaveBeenCalledWith('d1', {
      verifiedBy: 'JS',
      pohRevision: 'Rev 7',
      verifiedOn: '2026-05-01',
    })
  })

  it('renders the provenance line and no verify button for a fresh verified profile', () => {
    const profile = makeProfile({
      status: 'verified',
      verification: {
        verifiedOn: today,
        verifiedBy: 'AB',
        pohRevision: 'Rev 4',
        sourceWeighingDate: '2025-01-01',
      },
    })
    const { wrapper } = mountWithStore([profile])

    expect(wrapper.text()).toContain('Verified by AB on')
    expect(wrapper.text()).toContain('POH Rev 4')
    expect(wrapper.find('.btn-verify').exists()).toBe(false)
  })

  it('flags an expired verification with the Expired badge and a re-verify affordance', () => {
    const profile = makeProfile({
      status: 'verified',
      verification: {
        verifiedOn: '2000-01-01',
        verifiedBy: 'AB',
        pohRevision: 'Rev 4',
        sourceWeighingDate: '2025-01-01',
      },
    })
    const { wrapper } = mountWithStore([profile])

    expect(wrapper.find('.profile-status-badge').text()).toBe('Expired')
    const verifyBtn = wrapper.find('.btn-verify')
    expect(verifyBtn.exists()).toBe(true)
    expect(verifyBtn.attributes('aria-label')).toContain('Re-verify')
    expect(wrapper.text()).toContain('Verification expired')
  })

  it('re-attests an expired verified profile in place via reverifyProfile', async () => {
    const profile = makeProfile({
      id: 'v1',
      status: 'verified',
      verification: {
        verifiedOn: '2000-01-01',
        verifiedBy: 'AB',
        pohRevision: 'Rev 4',
        sourceWeighingDate: '2025-01-01',
      },
    })
    const { wrapper, fleet } = mountWithStore([profile])
    const reverifySpy = vi.spyOn(fleet, 'reverifyProfile')
    const verifySpy = vi.spyOn(fleet, 'verifyProfile')

    await wrapper.find('.btn-verify').trigger('click')
    ;(
      wrapper.vm as unknown as {
        onConfirmVerify(s: { verifiedBy: string; pohRevision: string; verifiedOn: string }): void
      }
    ).onConfirmVerify({ verifiedBy: 'CD', pohRevision: 'Rev 5', verifiedOn: today })
    await flushPromises()

    expect(reverifySpy).toHaveBeenCalledWith('v1', {
      verifiedBy: 'CD',
      pohRevision: 'Rev 5',
      verifiedOn: today,
    })
    expect(verifySpy).not.toHaveBeenCalled()
  })
})

describe('FleetList — verify-on-arrival deep link (?verify=<id>)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens the verify dialog for the matching profile when the route carries ?verify', async () => {
    const profile = makeProfile({ id: 'new-draft', status: 'draft' })
    const pinia = createPinia()
    setActivePinia(pinia)
    makeFleetStore({ profiles: [profile] })()
    makeActiveStore(null)()
    const router = makeRouter()
    router.push({ path: '/fleet', query: { verify: 'new-draft' } })
    await router.isReady()

    mount(FleetList, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(document.querySelector('.verify-dialog')).not.toBeNull()
    expect(document.body.textContent).toContain(profile.registration)
    // The query is stripped so a reload doesn't re-trigger the dialog.
    expect(router.currentRoute.value.query.verify).toBeUndefined()
  })

  it('does not open the dialog when the ?verify id does not match any profile', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    makeFleetStore({ profiles: [makeProfile({ id: 'other' })] })()
    makeActiveStore(null)()
    const router = makeRouter()
    router.push({ path: '/fleet', query: { verify: 'no-match' } })
    await router.isReady()

    mount(FleetList, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(document.querySelector('.verify-dialog')).toBeNull()
  })
})
