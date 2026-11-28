/**
 * Unit tests for AircraftProfileEditorView.vue
 * Covers: profile hydration, dirty-tracking, save dispatch to updateProfile (Draft)
 * vs editVerifiedProfile (Verified), and cancel navigation.
 *
 * @see frontend/src/modules/aircraft/views/AircraftProfileEditorView.vue
 */


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
    powertrain: 'combustion',
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

  it('loads the profile by route id and shows its registration', async () => {
    const profile = makeProfile({ registration: 'G-ABCD' })
    const { wrapper } = await mountEditor({ profile })
    expect(wrapper.text()).toContain('G-ABCD')
  })

  it('shows verified notice only when source profile is verified', async () => {
    const verified = makeProfile({ status: 'verified' })
    const { wrapper } = await mountEditor({ profile: verified })
    expect(wrapper.text()).toMatch(/convert it back to a/i)
    expect(wrapper.text()).toContain('Save (converts to Draft)')
  })

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

  it('validates and saves passenger edits through the verified draft path', async () => {
    const verified = makeProfile({ status: 'verified', passengerProfiles: [{ name: 'Old', standardWeight: 80, unit: 'kg' }] })
    const editVerifiedProfile = vi.fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>().mockResolvedValue(verified)
    const { wrapper } = await mountEditor({ profile: verified, fleetOverrides: { editVerifiedProfile } })
    const section = wrapper.findAll('button').find((button) => button.text().includes('Passenger Profiles'))!
    await section.trigger('click')
    await wrapper.find(`[id="${verified.id}-passengers-name-0"]`).setValue('  ')
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
    await wrapper.find(`[id="${verified.id}-passengers-name-0"]`).setValue('Adult')
    await wrapper.find(`[id="${verified.id}-passengers-weight-0"]`).setValue('180')
    await wrapper.find(`[id="${verified.id}-passengers-unit-0"]`).setValue('lbs')
    expect(verified.passengerProfiles[0]).toEqual({ name: 'Old', standardWeight: 80, unit: 'kg' })
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()
    expect(editVerifiedProfile).toHaveBeenCalledWith(verified.id, expect.objectContaining({ passengerProfiles: [{ name: 'Adult', standardWeight: 180, unit: 'lbs' }] }))
  })

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

  it('keeps save button disabled when there are no changes (no draft-bump on open)', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper } = await mountEditor({ profile: draft })
    const save = wrapper.find('.btn-primary')
    expect(save.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('No changes')
  })

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

  it('navigates back to fleet list when Cancel is clicked with no changes', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper, router } = await mountEditor({ profile: draft })
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.find('.btn-secondary').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'fleet' })
  })
})

describe('AircraftProfileEditorView — powertrain immutability & battery pack', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('locks the powertrain control (no radio buttons) when editing a combustion profile', async () => {
    const draft = makeProfile({ status: 'draft', powertrain: 'combustion' })
    const { wrapper } = await mountEditor({ profile: draft })

    expect(wrapper.findAll('input[type="radio"][name="powertrain"]')).toHaveLength(0)
    expect(wrapper.find('.powertrain-readonly').exists()).toBe(true)
    expect(wrapper.find('.powertrain-readonly').text()).toContain('Combustion')
  })

  it('locks the powertrain control when editing an electric profile and renders the Battery Pack section', async () => {
    const electric = makeProfile({
      status: 'draft',
      powertrain: 'electric',
      batteryPack: { usableEnergyKwh: 24.8, reserveFloorKwh: 4 },
    })
    const { wrapper } = await mountEditor({ profile: electric })

    expect(wrapper.findAll('input[type="radio"][name="powertrain"]')).toHaveLength(0)
    expect(wrapper.find('.powertrain-readonly').text()).toContain('Electric')
    // Battery Pack accordion title is surfaced once the profile is electric.
    expect(wrapper.text()).toContain('Battery Pack')
    // BatteryPackSection's usable-energy label + the seeded value.
    expect(wrapper.text()).toContain('Usable Energy')
  })

  it('does NOT render the Battery Pack section for a combustion profile', async () => {
    const draft = makeProfile({ status: 'draft', powertrain: 'combustion' })
    const { wrapper } = await mountEditor({ profile: draft })

    expect(wrapper.text()).not.toContain('Battery Pack')
    expect(wrapper.text()).not.toContain('Usable Energy')
  })

  it('disables the Save button when an electric profile has a reserve floor ≥ usable energy', async () => {
    const electric = makeProfile({
      status: 'draft',
      powertrain: 'electric',
      batteryPack: { usableEnergyKwh: 24.8, reserveFloorKwh: 4 },
    })
    const { wrapper } = await mountEditor({ profile: electric })

    // Force reserve floor above usable energy via the component's input.
    const reserveInput = wrapper.find(`input[id="${electric.id}-battery-reserve-floor"]`)
    expect(reserveInput.exists()).toBe(true)
    await reserveInput.setValue('40')
    await flushPromises()
    await nextTick()

    const save = wrapper.find('.btn-primary')
    expect(save.attributes('disabled')).toBeDefined()
  })
})

describe('AircraftProfileEditorView — wind limits', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the Wind Limits section with a "Not set" summary for a profile without limits', async () => {
    const draft = makeProfile({ status: 'draft' })
    const { wrapper } = await mountEditor({ profile: draft })
    expect(wrapper.text()).toContain('Wind Limits')
    expect(wrapper.text()).toContain('Not set')
  })

  it('persists an added crosswind limit through the save payload', async () => {
    const draft = makeProfile({ status: 'draft' })
    const updateProfile = vi
      .fn<(id: string, changes: Partial<AircraftProfile>) => Promise<AircraftProfile>>()
      .mockResolvedValue(draft)
    const { wrapper } = await mountEditor({
      profile: draft,
      fleetOverrides: { updateProfile },
    })

    // AccordionSection uses v-show, so the section controls are in the DOM even
    // while the accordion is collapsed by default. `.btn-add-row` is shared with
    // the Load Stations section, so disambiguate by the button label.
    const addWindLimit = wrapper
      .findAll('.btn-add-row')
      .find((b) => b.text().includes('Add Wind Limit'))
    expect(addWindLimit).toBeDefined()
    await addWindLimit!.trigger('click')
    await nextTick()
    await wrapper.find(`input[id="${draft.id}-windlimits-value-0"]`).setValue('15')
    await nextTick()

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledTimes(1)
    const changes = updateProfile.mock.calls[0]![1]
    expect(changes.windLimits).toEqual([
      { component: 'MaxCrosswind', value: 15, classification: 'Demonstrated' },
    ])
  })
})

describe('AircraftProfileEditorView — incomplete lookup source preservation', () => {
  it.each([false, true])('preserves lookup quantities during unrelated save or unit correction (%s)', async (correctUnit) => {
    const tank = {
      name: 'Legacy tank', arm: null,
      armLookup: [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 50, moment: 150 }],
      operationalLimit: null, defaultQuantity: 0, unit: '', allowableCategories: null,
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL' as const], burnSequences: [] },
    }
    const profile = makeProfile({ loadPoints: [tank] })
    const updateProfile = vi.fn<() => Promise<AircraftProfile>>().mockResolvedValue(profile)
    const { wrapper } = await mountEditor({ profile, fleetOverrides: { updateProfile } })
    await wrapper.get('input[id$="refDatumDesc"]').setValue('Changed synthetic datum')
    if (correctUnit) await wrapper.get('select[id$="unit-0"]').setValue('kg')
    const save = wrapper.findAll('button').find((button) => button.text() === 'Save Draft')!
    await save.trigger('click')
    await flushPromises()
    expect(updateProfile).toHaveBeenCalledWith(profile.id, expect.objectContaining({ loadPoints: [{ ...tank, unit: correctUnit ? 'kg' : '' }] }))
    expect(profile.loadPoints).toEqual([tank])
  })
})

describe('AircraftProfileEditorView — powertrain-gated fuel controls', () => {
  const tank = {
    name: 'Stored tank', arm: 1, armLookup: [], operationalLimit: null,
    defaultQuantity: 0, unit: 'kg', allowableCategories: null,
    fuelTank: { unusableFuel: 1, permissibleFuelTypes: ['AvGas 100LL' as const], burnSequences: [] },
  }

  it('hides fuel-tank controls for an electric profile and keeps stored tank data on save', async () => {
    const profile = makeProfile({
      powertrain: 'electric',
      batteryPack: { usableEnergyKwh: 24.8, reserveFloorKwh: 4 },
      loadPoints: [tank],
    })
    const updateProfile = vi.fn<() => Promise<AircraftProfile>>().mockResolvedValue(profile)
    const { wrapper } = await mountEditor({ profile, fleetOverrides: { updateProfile } })
    expect(wrapper.find('.btn-add-fuel').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('This station is a fuel tank')
    expect(wrapper.text()).not.toContain('Permissible Fuel Types')
    expect(wrapper.text()).not.toContain('Burn Sequences')
    await wrapper.get('input[id$="refDatumDesc"]').setValue('Changed synthetic datum')
    await wrapper.findAll('button').find((b) => b.text() === 'Save Draft')!.trigger('click')
    await flushPromises()
    expect(updateProfile).toHaveBeenCalledWith(profile.id, expect.objectContaining({ loadPoints: [tank] }))
  })

  it('shows fuel-tank controls for a combustion profile', async () => {
    const profile = makeProfile({ powertrain: 'combustion', loadPoints: [tank] })
    const { wrapper } = await mountEditor({ profile })
    expect(wrapper.find('.btn-add-fuel').exists()).toBe(true)
    expect(wrapper.text()).toContain('This station is a fuel tank')
    expect(wrapper.text()).toContain('Burn Sequences')
  })
})
