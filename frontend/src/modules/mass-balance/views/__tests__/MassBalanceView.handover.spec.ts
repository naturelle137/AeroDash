import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MassBalanceView from '../MassBalanceView.vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import HandoverExchange from '@/modules/export/HandoverExchange.vue'
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const downloaded = vi.hoisted(() => ({ text: '' }))
vi.mock('@/modules/export/flight-prep-json', async (original) => ({
  ...await original<typeof import('@/modules/export/flight-prep-json')>(),
  downloadFlightPrepJson: (text: string) => { downloaded.text = text },
}))
vi.mock('@/modules/export/handover-file', () => ({
  downloadHandoverFile: (text: string) => { downloaded.text = text },
}))

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<(input: unknown) => MathCoreResult>().mockReturnValue({
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [],
  }),
}))

// Mock fleet repository — no IndexedDB in jsdom
vi.mock('@/modules/aircraft/services/fleet.repository', () => ({
  fleetRepository: {
    findAll: vi.fn<() => Promise<AircraftProfile[]>>().mockResolvedValue([]),
    create: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteById: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findById: vi.fn<() => Promise<AircraftProfile | undefined>>().mockResolvedValue(undefined),
    openDB: vi.fn<() => Promise<IDBDatabase>>().mockResolvedValue({} as IDBDatabase),
  },
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Build a minimal valid AircraftProfile for the fleet. */
function buildFleetProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000001',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'verified',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot & Passenger',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 200,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: ['Normal'],
        fuelTank: null,
      },
    ],
    certificationCategories: [
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
    ],
    ...overrides,
  }
}

function mountWithAircraft() {
  const profile = buildFleetProfile()
  const fleet = useFleetStore()
  fleet.profiles = [profile]
  fleet.fleetLoadState = 'READY'
  const wrapper = mount(MassBalanceView, { global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })] } })
  return { wrapper, profile }
}

describe('MassBalanceView — handover file', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    downloaded.text = ''
  })

  it('exports current entries and unavailable values without verification claims', async () => {
    const { wrapper, profile } = mountWithAircraft()
    await wrapper.find('select#aircraft-select').setValue(profile.id)
    const mb = useMassBalanceStore()
    mb.stations[0]!.weight = 120
    await wrapper.find('[data-testid="flight-prep-export"]').trigger('click')
    const file = JSON.parse(downloaded.text)
    expect(file).toMatchObject({ format: 'aerodash-flight-preparation', version: 1, aircraft: { registration: 'D-EBPN' }, massBalance: { stations: [{ weight: 120, unit: 'kg' }] }, entries: { fuel: { directTripFuel: '' }, performance: { temperature: '' } }, runway: { saved: null } })
    expect(file.notice).toContain('Unverified')
    expect(downloaded.text).not.toContain('ownerId')
  })

  it('is offered only with a loaded aircraft', () => {
    const { wrapper } = mountWithAircraft()
    expect(wrapper.find('[data-testid="handover-exchange"]').exists()).toBe(false)
  })

  it('exports an unreviewed file and re-imports edited weights as unverified', async () => {
    const { wrapper, profile } = mountWithAircraft()
    await wrapper.find('select#aircraft-select').setValue(profile.id)
    const mb = useMassBalanceStore()
    mb.stations[0]!.weight = 120
    mb.stations[0]!.verified = true

    await wrapper.find('[data-testid="handover-export"]').trigger('click')
    const file = JSON.parse(downloaded.text) as { review: string; massBalance: { stations: { weight: number }[] } }
    expect(file.review).toBe('unreviewed')
    expect(file.massBalance.stations[0]!.weight).toBe(120)

    // The recipient edits the file; the import takes the edited weight but not the verification.
    file.massBalance.stations[0]!.weight = 95
    wrapper.findComponent(HandoverExchange).vm.$emit('import', JSON.stringify(file))
    await wrapper.vm.$nextTick()

    expect(mb.stations[0]!.weight).toBe(95)
    expect(mb.stations[0]!.verified).toBe(false)
    const notice = wrapper.find('[data-testid="handover-notice"]')
    expect(notice.text()).toContain('unreviewed')
    expect(notice.text()).toContain('Not approved')
  })

  it.each([
    ['another aircraft', (t: string) => t.replace('D-EBPN', 'D-OTHR'), 'D-OTHR'],
    ['another station layout', (t: string) => t.replace('Pilot & Passenger', 'Cargo'), 'stations'],
    ['a different station unit', (t: string) => t.replace('"unit": "kg"', '"unit": "lb"'), 'stations'],
    ['a nested approval field', (t: string) => t.replace('"method"', '"approval": true, "method"'), 'Nothing was imported'],
    ['an approval field', (t: string) => t.replace('"review"', '"approvedBy": "FI", "review"'), 'Nothing was imported'],
  ])('refuses a file for %s and leaves entries unchanged', async (_label, edit, expected) => {
    const { wrapper, profile } = mountWithAircraft()
    await wrapper.find('select#aircraft-select').setValue(profile.id)
    const mb = useMassBalanceStore()
    mb.stations[0]!.weight = 120
    await wrapper.find('[data-testid="handover-export"]').trigger('click')
    mb.stations[0]!.weight = 60

    wrapper.findComponent(HandoverExchange).vm.$emit('import', edit(downloaded.text))
    await wrapper.vm.$nextTick()

    expect(mb.stations[0]!.weight).toBe(60)
    expect(wrapper.find('[data-testid="handover-notice"]').text()).toContain(expected)
  })
})
