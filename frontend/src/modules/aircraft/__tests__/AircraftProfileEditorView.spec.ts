/**
 * Unit tests for AircraftProfileEditorView.vue
 * Covers: profile hydration, dirty-tracking, save dispatch to updateProfile (Draft)
 * vs editVerifiedProfile (Verified), and cancel navigation.
 *
 * @see frontend/src/modules/aircraft/views/AircraftProfileEditorView.vue
 */

// @UT-AC-VIEW-130@ (FROM: @IMP-AC-VIEW-015@, @IMP-AC-VIEW-016@)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import AircraftProfileEditorView from '../views/AircraftProfileEditorView.vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

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
    passengerProfiles: [],
    weighingReports: [{ bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
    loadPoints: [],
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

interface FleetStubOverrides {
  profiles?: AircraftProfile[]
  updateProfile?: ReturnType<typeof vi.fn>
  editVerifiedProfile?: ReturnType<typeof vi.fn>
  loadAll?: ReturnType<typeof vi.fn>
}

function makeFleetStore(overrides: FleetStubOverrides) {
  return defineStore('fleet', () => {
    const list = overrides.profiles ?? []
    const profiles = ref<AircraftProfile[]>(list)
    const fleetLoadState = ref<'LOADING' | 'READY' | 'ERROR'>('READY')
    const fleetLoadError = ref<string | null>(null)
    const notifications = ref<unknown[]>([])
    const first = list[0] ?? makeProfile()
    const updateProfile =
      overrides.updateProfile ?? vi.fn<() => Promise<AircraftProfile>>().mockResolvedValue(first)
    const editVerifiedProfile =
      overrides.editVerifiedProfile ??
      vi.fn<() => Promise<AircraftProfile>>().mockResolvedValue(first)
    const loadAll = overrides.loadAll ?? vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    return {
      profiles,
      fleetLoadState,
      fleetLoadError,
      notifications,
      updateProfile,
      editVerifiedProfile,
      loadAll,
    }
  })
}

async function mountEditor(options: {
  profile: AircraftProfile
  fleetOverrides?: FleetStubOverrides
}): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
  store: ReturnType<ReturnType<typeof makeFleetStore>>
}> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const useStore = makeFleetStore({
    profiles: [options.profile],
    ...options.fleetOverrides,
  })
  const store = useStore()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/fleet/:id/edit',
        name: 'fleet-edit',
        component: AircraftProfileEditorView,
      },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
    ],
  })
  await router.push({ name: 'fleet-edit', params: { id: options.profile.id } })
  await router.isReady()
  const wrapper = mount(AircraftProfileEditorView, {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  await nextTick()
  return { wrapper, router, store }
}

describe('AircraftProfileEditorView — hydration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-AC-VIEW-130@
  it('loads the profile by route id and shows its registration', async () => {
    const profile = makeProfile({ registration: 'G-ABCD' })
    const { wrapper } = await mountEditor({ profile })
    expect(wrapper.text()).toContain('G-ABCD')
  })

  // @UT-AC-VIEW-131@
  it('shows verified notice only when source profile is verified', async () => {
    const verified = makeProfile({ status: 'verified' })
    const { wrapper } = await mountEditor({ profile: verified })
    expect(wrapper.text()).toMatch(/convert it back to a/i)
    expect(wrapper.text()).toContain('Save (converts to Draft)')
  })

  // @UT-AC-VIEW-132@
  it('shows draft save label when source is draft', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper } = await mountEditor({ profile: draft })
    expect(wrapper.text()).toContain('Save Draft')
  })
})

describe('AircraftProfileEditorView — save dispatch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-AC-VIEW-133@
  it('calls updateProfile when saving a Draft', async () => {
    const draft = makeProfile({ status: 'draft' })
    const updateProfile = vi.fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>()
      .mockResolvedValue(draft)
    const editVerifiedProfile = vi.fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>()
    const { wrapper } = await mountEditor({
      profile: draft,
      fleetOverrides: { updateProfile, editVerifiedProfile },
    })
    // Change source-unit to mark dirty
    const source = wrapper.find(`[id="${draft.id}-identity-sourceUnit"]`)
    await source.setValue('lb')
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(editVerifiedProfile).not.toHaveBeenCalled()
    const args = updateProfile.mock.calls[0]!
    expect(args[0]).toBe(draft.id)
    expect(args[1]).toMatchObject({ sourceUnit: 'lb' })
    expect(args[1]).not.toHaveProperty('id')
    expect(args[1]).not.toHaveProperty('status')
  })

  // @UT-AC-VIEW-134@
  it('calls editVerifiedProfile when saving a Verified profile', async () => {
    const verified = makeProfile({ status: 'verified' })
    const updateProfile = vi.fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>()
    const editVerifiedProfile = vi.fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>()
      .mockResolvedValue(verified)
    const { wrapper } = await mountEditor({
      profile: verified,
      fleetOverrides: { updateProfile, editVerifiedProfile },
    })
    const source = wrapper.find(`[id="${verified.id}-identity-sourceUnit"]`)
    await source.setValue('lb')
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()
    expect(editVerifiedProfile).toHaveBeenCalledTimes(1)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  // @UT-AC-VIEW-135@
  it('keeps save button disabled when there are no changes (no draft-bump on open)', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper } = await mountEditor({ profile: draft })
    const save = wrapper.find('.btn-primary')
    expect(save.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('No changes')
  })

  // @UT-AC-VIEW-136@
  it('enables save and shows unsaved-changes indicator when a field is edited', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper } = await mountEditor({ profile: draft })
    const source = wrapper.find(`[id="${draft.id}-identity-sourceUnit"]`)
    await source.setValue('lb')
    const save = wrapper.find('.btn-primary')
    expect(save.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Unsaved changes')
  })
})

describe('AircraftProfileEditorView — navigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-AC-VIEW-137@
  it('navigates back to fleet list when Cancel is clicked with no changes', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper, router } = await mountEditor({ profile: draft })
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.find('.btn-secondary').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'fleet' })
  })
})
