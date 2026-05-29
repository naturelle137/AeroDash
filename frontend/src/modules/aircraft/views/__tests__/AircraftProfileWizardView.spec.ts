/**
 * Component tests for AircraftProfileWizardView — the post-save action chooser
 * (UX-012) and the in-app exit modal that replaces native confirm() (UX-015).
 *
 * The heavy data-entry section components are mocked with stubs that emit valid
 * model values on mount, so the wizard reaches a saveable state without driving
 * every field through the DOM.
 *
 * @see frontend/src/modules/aircraft/views/AircraftProfileWizardView.vue
 */

// @UT-AC-VIEW-183@ (FROM: @IMP-AC-VIEW-032@, @IMP-AC-VIEW-033@)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// Hoisted so the (hoisted) vi.mock factories below can reference them.
const h = vi.hoisted(() => {
  const identityValue = {
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    powertrain: 'combustion',
    shareCode: null,
  }
  const envelopeValue = [
    {
      category: 'Normal',
      mtom: 630,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.841, mass: 630 },
        { armOrMoment: 1.978, mass: 630 },
        { armOrMoment: 1.978, mass: 433 },
      ],
    },
  ]
  const weighingValue = [
    { bem: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ]
  const makeStub = (value: unknown) => ({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="section-stub" />',
    mounted(this: { $emit: (event: string, payload: unknown) => void }) {
      this.$emit('update:modelValue', value)
    },
  })
  return { identityValue, envelopeValue, weighingValue, makeStub }
})

vi.mock('../../components/IdentitySection.vue', () => ({ default: h.makeStub(h.identityValue) }))
vi.mock('../../components/EnvelopeSection.vue', () => ({ default: h.makeStub(h.envelopeValue) }))
vi.mock('../../components/WeighingReportsSection.vue', () => ({
  default: h.makeStub(h.weighingValue),
}))
vi.mock('../../components/LoadPointsSection.vue', () => ({ default: h.makeStub([]) }))
vi.mock('../../components/BatteryPackSection.vue', () => ({
  default: { props: ['modelValue'], template: '<div />' },
}))

import AircraftProfileWizardView from '../AircraftProfileWizardView.vue'
import { useFleetStore } from '../../stores/fleet.store'
import { useActiveAircraftStore } from '../../stores/active-aircraft.store'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function newDraft(): AircraftProfile {
  return {
    id: 'new-draft-0000-4000-a000-000000000001',
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
    weighingReports: h.weighingValue,
    loadPoints: [],
    certificationCategories: h.envelopeValue as AircraftProfile['certificationCategories'],
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
      { path: '/fleet/new', name: 'fleet-new', component: AircraftProfileWizardView },
      { path: '/mass-balance', name: 'mass-balance', component: { template: '<div />' } },
    ],
  })
}

async function mountWizard() {
  const router = makeRouter()
  router.push('/fleet/new')
  await router.isReady()
  const wrapper = mount(
    { template: '<router-view />' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, router }
}

function actionButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('.action-choice__btn')] as HTMLButtonElement[]
}

function clickAction(label: string): void {
  const btn = actionButtons().find((b) => b.textContent?.includes(label))
  if (!btn) throw new Error(`No action button matching "${label}"`)
  btn.click()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AircraftProfileWizardView — post-save chooser & exit modal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  async function advanceToReview(wrapper: Awaited<ReturnType<typeof mountWizard>>['wrapper']) {
    // identity → envelope → weighing → load-stations → review
    for (let i = 0; i < 4; i++) {
      const cont = wrapper.findAll('button').find((b) => b.text().includes('Continue'))
      expect(cont, `Continue button missing at step ${i}`).toBeDefined()
      await cont!.trigger('click')
      await flushPromises()
    }
  }

  it('opens the post-save chooser instead of routing straight back to the fleet', async () => {
    const fleet = useFleetStore()
    vi.spyOn(fleet, 'createProfile').mockResolvedValue(newDraft())

    const { wrapper } = await mountWizard()
    await advanceToReview(wrapper)

    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save as Draft'))!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(document.querySelector('.action-choice__title')?.textContent).toContain(
      'Aircraft saved as draft',
    )
    const labels = actionButtons().map((b) => b.textContent?.trim())
    expect(labels).toContain('Start flight prep')
    expect(labels).toContain('Verify now')
    expect(labels).toContain('Back to Fleet')
  })

  it('Start flight prep sets the active aircraft and routes to Mass & Balance', async () => {
    const fleet = useFleetStore()
    const active = useActiveAircraftStore()
    const draft = newDraft()
    vi.spyOn(fleet, 'createProfile').mockResolvedValue(draft)
    const setActiveSpy = vi.spyOn(active, 'setActiveProfile')

    const { wrapper, router } = await mountWizard()
    await advanceToReview(wrapper)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save as Draft'))!
      .trigger('click')
    await flushPromises()

    clickAction('Start flight prep')
    await flushPromises()

    expect(setActiveSpy).toHaveBeenCalledWith(draft)
    expect(router.currentRoute.value.name).toBe('mass-balance')
  })

  it('Back to Fleet routes to the fleet list without setting an active aircraft', async () => {
    const fleet = useFleetStore()
    const active = useActiveAircraftStore()
    vi.spyOn(fleet, 'createProfile').mockResolvedValue(newDraft())
    const setActiveSpy = vi.spyOn(active, 'setActiveProfile')

    const { wrapper, router } = await mountWizard()
    await advanceToReview(wrapper)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save as Draft'))!
      .trigger('click')
    await flushPromises()

    clickAction('Back to Fleet')
    await flushPromises()

    expect(setActiveSpy).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('fleet')
  })

  it('shows the in-app exit modal (never native confirm) when leaving with unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { wrapper } = await mountWizard()

    await wrapper.find('.btn-back').trigger('click')
    await flushPromises()

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(document.querySelector('.action-choice__title')?.textContent).toContain(
      'Leave the aircraft wizard',
    )
  })

  it('Keep editing cancels the navigation and stays in the wizard', async () => {
    const { wrapper, router } = await mountWizard()

    await wrapper.find('.btn-back').trigger('click')
    await flushPromises()
    clickAction('Keep editing')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/fleet/new')
    expect(document.querySelector('.action-choice')).toBeNull()
  })

  it('Discard changes abandons the build and navigates away', async () => {
    const { wrapper, router } = await mountWizard()

    await wrapper.find('.btn-back').trigger('click')
    await flushPromises()
    clickAction('Discard changes')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('fleet')
  })
})
