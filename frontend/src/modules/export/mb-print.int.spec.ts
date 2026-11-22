import { computeWindComponents } from '@/core/logic/wind-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { presentPerformance, presentOperationalAssessment } from '@/modules/performance/services/performance-presentation'
import MbPrintPreview from './MbPrintPreview.vue'
import { assembleMbPrint, canPrintMb, unverifiedGate, type MbPrintSource } from './mb-print'

function source(): MbPrintSource {
  setActivePinia(createPinia())
  const profile = testPohAircraft()
  profile.status = 'draft'
  const store = useMassBalanceStore()
  store.loadProfile(mapFleetProfileToContext(profile))
  return reactive({ state: store.uiState, ready: true, profile, aircraft: store.aircraft,
    category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI, stations: store.availableStations,
    notifications: store.notifications })
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
describe('M&B print presentation with real store calculation', () => {
  it('snapshots valid manual wind and omits invalid results', () => {
    const input = source()
    const entries = { runwayHeading: '270', windDirection: '330', windSpeed: '20', unit: 'kt' }
    input.profile!.windLimits = [{ component: 'MaxCrosswind', value: 10, classification: 'Limit' }]
    input.wind = { input: entries, result: computeWindComponents(entries) }
    const snapshot = assembleMbPrint(input, new Date())!
    expect(snapshot.wind?.result).toMatchObject({ headwind: 10, crosswind: 17.3 })
    expect(snapshot.wind?.notifications[0]?.id).toBe('CRIT-WX-001')
    entries.windDirection = 'VRB'
    expect(snapshot.wind?.input.windDirection).toBe('330')
    input.wind.result = computeWindComponents(entries)
    expect(assembleMbPrint(input, new Date())!.wind).toBeNull()
  })
  it('snapshots gust warnings and removes them after the gust changes', () => {
    const input = source()
    const entries = { runwayHeading: '270', windDirection: '330', windSpeed: '5', unit: 'kt', gustSpeed: '20' }
    input.profile!.windLimits = [{ component: 'MaxCrosswind', value: 10, classification: 'Demonstrated' }]
    input.wind = { input: entries, result: computeWindComponents(entries) }
    const snapshot = assembleMbPrint(input, new Date())!
    expect(snapshot.wind?.notifications[0]?.message).toContain('manual gust')
    entries.gustSpeed = ''
    expect(snapshot.wind?.input.gustSpeed).toBe('20')
    expect(assembleMbPrint(input, new Date())!.wind?.notifications).toEqual([])
  })
  it('retains warnings, honest endpoints, units and draft markers without mutating verification', () => {
    const input = source()
    const before = JSON.stringify(input)
    const result = assembleMbPrint(input, new Date('2026-11-14T12:00:00Z'))!
    expect(result.points.map(p => p.label)).toEqual(['Takeoff', 'Zero fuel', 'All usable fuel burned'])
    expect(result.points[0]!.mass).toBe('500.0 kg [UNVERIFIED]')
    expect(result.status).toBe('draft; draft [UNVERIFIED]')
    expect(result.notifications).toEqual(input.notifications.map(({ id, severity, message, context }) => ({ id, severity, message, context })))
    expect(result.generated).toContain('(UTC)')
    expect(JSON.stringify(input)).toBe(before)
  })
  it('normalizes source limits and marks expired and unattributed provenance', () => {
    const input = source()
    input.aircraft!.sourceUnit = 'lb-in'
    input.category!.maxTakeoffMass = 1000
    input.category!.envelope[0] = { mass: 1000, armOrMoment: 40 }
    let result = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(result.mtom).toBe('453.5 kg [UNVERIFIED]')
    expect(result.envelope[0]!.horizontal).toBe('1.016 m [UNVERIFIED]')
    input.profile!.status = 'verified'
    expect(assembleMbPrint(input, new Date('2026-11-14'))!.status).toContain('verified-unattributed [UNVERIFIED]')
    input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'TEST', pohRevision: 'Synthetic', sourceWeighingDate: '2026-01-01' }
    result = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(result.status).toContain('expired-aged [UNVERIFIED]')
    expect(result.provenance!.revision).toBe('Synthetic')
  })
  it.each(['lb-in', 'kg'] as const)('rounds %s limits DOWN and actual masses UP with freshness markers', sourceUnit => {
    setActivePinia(createPinia())
    const profile = testPohAircraft()
    profile.sourceUnit = sourceUnit
    profile.status = 'verified'
    profile.verification = { verifiedOn: '2026-11-01', verifiedBy: 'TEST', pohRevision: 'Synthetic', sourceWeighingDate: '2026-01-01' }
    const imperial = sourceUnit === 'lb-in'
    profile.weighingReports[0]!.bem = imperial ? 1500 : 680.388555
    profile.weighingReports[0]!.emptyCg = imperial ? 40 : 1.016
    profile.certificationCategories = [{
      category: 'Normal', mtom: imperial ? 2400 : 1088.621688,
      maxZeroFuelMass: imperial ? 2000 : 907.18474, graphType: 'arm',
      envelope: [
        { mass: imperial ? 1000 : 400, armOrMoment: imperial ? 20 : 0.5 },
        { mass: imperial ? 2600 : 1200, armOrMoment: imperial ? 20 : 0.5 },
        { mass: imperial ? 2600 : 1200, armOrMoment: imperial ? 60 : 1.5 },
        { mass: imperial ? 1000 : 400, armOrMoment: imperial ? 60 : 1.5 },
      ],
    }]
    const store = useMassBalanceStore()
    store.loadProfile(mapFleetProfileToContext(profile))
    const input: MbPrintSource = { state: store.uiState, ready: true, profile, aircraft: store.aircraft,
      category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI,
      stations: store.availableStations, notifications: store.notifications }
    expect(store.lastResult!.takeoffCenterOfGravityPoint.mass).toBeCloseTo(680.388555, 6)
    for (const [date, marker] of [['2026-11-14', ''], ['2027-03-01', ' [UNVERIFIED]']] as const) {
      const result = assembleMbPrint(input, new Date(date))!
      expect(result.mtom).toBe(`1088.6 kg${marker}`)
      expect(result.mzfm).toBe(`907.1 kg${marker}`)
      expect(result.points.map(point => point.limit)).toEqual([
        `MTOM: 1088.6 kg${marker}`, `MZFM: 907.1 kg${marker}`, 'Not specified',
      ])
      expect(result.points.map(point => point.mass)).toEqual(Array(3).fill(`680.4 kg${marker}`))
      expect(result.marker).toBe(marker)
      expect(result.unverified).toBe(marker !== '')
    }
    input.category!.maxZeroFuelMass = null
    const absent = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(absent.mzfm).toBe('Not specified')
    expect(absent.points[1]!.limit).toBe('Not specified')
    profile.status = 'draft'
    const draft = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(draft.mtom).toBe('1088.6 kg [UNVERIFIED]')
    expect(draft.points[0]!.mass).toBe('680.4 kg [UNVERIFIED]')
    expect(draft.mzfm).toBe('Not specified')
  })
  it('prints lb-in moment envelope rows in kg·m from the real store calculation', () => {
    // Synthetic vectors: 1 lb = 0.45359237 kg, 1 in = 0.0254 m. 50000 / 100000 lb·in =
    // 576.0623099 / 1152.1246198 kg·m; BEM 1500 lb × 40 in = 691.27477188 kg·m.
    setActivePinia(createPinia())
    const profile = testPohAircraft()
    profile.status = 'draft'
    profile.sourceUnit = 'lb-in'
    profile.weighingReports = [{ bem: 1500, emptyCg: 40, weighingDate: '2026-01-01', validFrom: '2026-01-01' }]
    profile.certificationCategories = [{
      category: 'Normal', mtom: 2400, maxZeroFuelMass: null, graphType: 'moment',
      envelope: [
        { mass: 1500, armOrMoment: 50000 }, { mass: 2600, armOrMoment: 50000 },
        { mass: 2600, armOrMoment: 100000 }, { mass: 1500, armOrMoment: 100000 },
      ],
    }]
    const store = useMassBalanceStore()
    store.loadProfile(mapFleetProfileToContext(profile))
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBeCloseTo(691.27477188, 6)
    const result = assembleMbPrint(reactive({ state: store.uiState, ready: true, profile, aircraft: store.aircraft,
      category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI, stations: store.availableStations,
      notifications: store.notifications }), new Date('2026-11-14'))!
    expect(result.graphType).toBe('moment')
    expect(result.envelope.map(r => r.horizontal)).toEqual([
      '576.062 kg·m [UNVERIFIED]', '576.062 kg·m [UNVERIFIED]',
      '1152.125 kg·m [UNVERIFIED]', '1152.125 kg·m [UNVERIFIED]',
    ])
    expect(result.chart.envelope).toEqual(store.activeEnvelopeSI)
    expect(result.chart.result).toEqual(store.lastResult)
    expect(result.chart.envelope[0]!.armOrMoment).toBeCloseTo(576.0623099, 6)
    expect(result.envelope[0]!.mass).toBe('680.4 kg [UNVERIFIED]')
    expect(result.points[0]!.cg).toBe('1.016 m [UNVERIFIED]')
  })
  it.each(['INITIAL', 'LOADING', 'UNCONFIGURED', 'UNVERIFIED', 'ERROR_CRITICAL'] as const)('blocks retained success in %s', state => {
    const input = source()
    input.state = state
    expect(assembleMbPrint(input, new Date())).toBeNull()
  })
  it('exports only known computed exceedances and binds exact warnings to affected values', () => {
    const input = source()
    input.state = 'ERROR_CRITICAL'
    input.result!.violations.push({ type: 'MTOM_EXCEEDED' }, { type: 'CG_OUT_OF_ENVELOPE' })
    input.notifications.push(
      { id: 'CRIT-MB-002', severity: 'CRITICAL', message: 'MTOM Exceeded', context: 'MassBalance.TotalMass', persistent: false, dismissible: true },
      { id: 'CRIT-MB-001', severity: 'CRITICAL', message: 'CG Out of Envelope', context: 'MassBalance.CG', persistent: false, dismissible: true },
    )
    const pack = assembleMbPrint(input, new Date())!
    expect(pack.chart.severity).toBe('critical')
    expect(pack.points[0]!.massWarnings.map(n => n.message)).toContain('MTOM Exceeded')
    expect(pack.points[1]!.massWarnings.map(n => n.message)).not.toContain('MTOM Exceeded')
    expect(pack.points.map(p => p.cgWarnings.some(n => n.message === 'CG Out of Envelope'))).toEqual([true, false, false])
    input.result!.takeoffCenterOfGravityPoint.arm = NaN
    expect(canPrintMb(input)).toBe(false)
    input.result!.takeoffCenterOfGravityPoint.arm = 1
    input.notifications.push({ id: 'CRIT-SYS-002', severity: 'CRITICAL', message: 'Adapter failed', persistent: false, dismissible: false })
    expect(canPrintMb(input)).toBe(false)
  })
  it('associates a real synthetic takeoff-only exceedance with takeoff', () => {
    setActivePinia(createPinia())
    const profile = testPohAircraft()
    profile.weighingReports[0]!.bem = 750
    profile.certificationCategories[0]!.envelope[2]!.armOrMoment = 1.05
    profile.certificationCategories[0]!.envelope[3]!.armOrMoment = 1.05
    profile.loadPoints = [{ name: 'Synthetic tank', kind: 'fuel', arm: 2, armLookup: [], operationalLimit: 100,
      defaultQuantity: 50, unit: 'kg', allowableCategories: null,
      fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } }]
    const store = useMassBalanceStore()
    store.loadProfile(mapFleetProfileToContext(profile))
    const input: MbPrintSource = { state: store.uiState, ready: true, profile, aircraft: store.aircraft,
      category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI,
      stations: store.availableStations, notifications: store.notifications }
    expect(input.result!.takeoffCenterOfGravityPoint.arm).toBeGreaterThan(1.05)
    expect(input.result!.zeroFuelCenterOfGravityPoint.arm).toBe(1)
    const pack = assembleMbPrint(input, new Date())!
    expect(pack.points.map(p => p.cgWarnings.some(n => n.id === 'CRIT-MB-001'))).toEqual([true, false, false])
  })
  it('keeps migration and unsubstantiated CG warnings at trajectory level', () => {
    const input = source()
    input.notifications.push(
      { id: 'CRIT-MB-001', severity: 'WARNING', message: 'CG evidence unavailable', context: 'MassBalance.CG', persistent: false, dismissible: true },
      { id: 'CRIT-MB-003', severity: 'WARNING', message: 'CG Migration Limit Exceeded', context: 'MassBalance.CG', persistent: false, dismissible: true },
    )
    const pack = assembleMbPrint(input, new Date())!
    expect(pack.cgTrajectoryWarnings.map(n => n.message)).toEqual(['CG evidence unavailable', 'CG Migration Limit Exceeded'])
    expect(pack.points.every(p => p.cgWarnings.every(n => n.context !== 'MassBalance.CG'))).toBe(true)
  })
  it('presents actionable warnings without exposing their internal IDs', async () => {
    const input = source()
    input.state = 'ERROR_CRITICAL'
    input.result!.violations.push({ type: 'MTOM_EXCEEDED' }, { type: 'CG_OUT_OF_ENVELOPE' })
    input.stations.push({ index: 0, name: 'Synthetic load', weight: 10, mandatory: false, touched: true, verified: false, hasError: false })
    input.notifications.push(
      { id: 'CRIT-MB-002', severity: 'CRITICAL', message: 'MTOM Exceeded', context: 'MassBalance.TotalMass', persistent: false, dismissible: true },
      { id: 'CRIT-MB-001', severity: 'CRITICAL', message: 'CG Out of Envelope', context: 'MassBalance.CG', persistent: false, dismissible: true },
      { id: 'WARN-MB-005', severity: 'WARNING', message: 'Station 0 limit exceeded', context: 'MassBalance.Loading', persistent: false, dismissible: true },
      { id: 'INFO-TEST-001', severity: 'INFO', message: 'Advisory details', context: 'MassBalance', persistent: false, dismissible: true },
    )
    const pack = assembleMbPrint(input, new Date())!
    expect(pack.notifications.map(n => n.id)).toContain('CRIT-MB-002')
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    const preview = document.querySelector('[role="dialog"]')!
    const text = preview.textContent!
    for (const id of ['CRIT-MB-002', 'CRIT-MB-001', 'WARN-MB-005', 'INFO-TEST-001']) expect(text).not.toContain(id)
    for (const message of ['MTOM Exceeded', 'CG Out of Envelope', 'Station 0 limit exceeded', 'Advisory details']) expect(text).toContain(message)
    expect(preview.querySelectorAll('.briefing-critical').length).toBeGreaterThan(1)
    expect([...preview.querySelectorAll('.briefing-warning')].some(e => e.textContent?.includes('Station 0 limit exceeded'))).toBe(true)
    expect(text).toContain('500.0 kg')
    expect(text).toContain('CRITICAL')
    wrapper.unmount()
  })
  it('prints instructor notes separately and leaves system warnings untouched', async () => {
    const input = source()
    input.stations.push({ index: 0, name: 'Synthetic load', weight: 10, mandatory: false, touched: true, verified: false, hasError: false })
    input.notifications.push({ id: 'WARN-MB-005', severity: 'WARNING', message: 'Station 0 limit exceeded', context: 'MassBalance.Loading', persistent: false, dismissible: true })
    const annotations = [{ id: 'n1', aircraftId: input.aircraft!.id, anchor: 'takeoff' as 'takeoff' | 'landingDistance', author: 'CRI Meyer', text: 'Aft CG migration', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }]
    annotations.push({ ...annotations[0]!, id: 'n2', anchor: 'landingDistance' as const, text: 'Check landing distance' })
    annotations.push({ ...annotations[0]!, id: 'n3', anchor: 'warning:mb:CRIT-1%20%C2%B7%20MTOM%20Exceeded' as never, text: 'Review overload' })
    const wrapper = mount(MbPrintPreview, { props: { source: input, annotations }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    const preview = document.querySelector('[role="dialog"]')!
    const section = preview.querySelector('[aria-label="Instructor notes"]')!
    expect(section.textContent).toContain('Instructor note on Takeoff')
    expect(section.textContent).toContain('CRI Meyer (self-declared, unverified): Aft CG migration')
    expect(section.textContent).toContain('Instructor note on Landing distance')
    expect(section.textContent).toContain('Warning: CRIT-1 · MTOM Exceeded')
    expect(section.textContent).toContain('Review overload')
    expect(section.textContent).toContain('Check landing distance')
    const notifications = [...preview.querySelectorAll('section')].find(e => e.getAttribute('aria-label') === 'Current M&B notifications')!
    expect(notifications.textContent).toContain('Station 0 limit exceeded')
    expect(notifications.textContent).not.toContain('Aft CG migration')
    expect([...preview.querySelectorAll('.briefing-warning')].some(e => e.textContent?.includes('Station 0 limit exceeded'))).toBe(true)
    wrapper.unmount()
  })
  it('blocks error notifications, pending selection, failed result and incomplete loading', () => {
    const input = source()
    input.ready = false
    expect(canPrintMb(input)).toBe(false)
    input.ready = true
    input.notifications.push({ id: 'test', severity: 'CRITICAL', message: 'Blocked', persistent: false, dismissible: false })
    expect(canPrintMb(input)).toBe(false)
    input.notifications.pop()
    input.result!.success = false
    expect(canPrintMb(input)).toBe(false)
    input.result!.success = true
    input.stations.push({ index: 0, name: 'Missing', weight: 0, mandatory: true, touched: false, verified: false, hasError: false })
    expect(canPrintMb(input)).toBe(false)
  })
  it.each(['loading', 'category', 'aircraft', 'status', 'notifications'] as const)('invalidates open preview on %s and blocks beforeprint', async change => {
    const input = source()
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    expect(document.body.classList.contains('mb-print-active')).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('500.0 kg')
    if (change === 'loading') input.stations.push({ index: 0, name: 'Added', weight: 10, mandatory: false, touched: true, verified: false, hasError: false })
    if (change === 'category') input.category!.category = 'Utility'
    if (change === 'aircraft') input.aircraft!.registration = 'D-NEXT'
    if (change === 'status') input.state = 'LOADING'
    if (change === 'notifications') input.notifications[0]!.message = 'New warning'
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('500.0 kg')
    expect(document.body.textContent).toContain('Preview invalidated')
    const print = [...document.querySelectorAll('button')].find(b => b.textContent === 'Print Briefing Pack')!
    expect(print.disabled).toBe(true)
    wrapper.unmount()
    expect(document.body.classList.contains('mb-print-active')).toBe(false)
  })
  it.each(['conditions', 'runway', 'units'] as const)('synchronously guards shared Performance %s changes and reopens a current pack', async change => {
    const input = source()
    input.notifications = []
    input.performance = presentPerformance({
      inputKey: 'initial', inputs: [], aircraft: null,
      takeoff: { status: 'ready', massKg: 500, origin: 'current M&B' },
      landing: { status: 'unavailable', reason: 'No actual trip arrival.' },
      assessment: null, pressureAltitudeBasis: '', pendingReason: 'Compute raw distances.',
      runway: { status: 'unavailable', reason: 'No declared runway.' },
      operational: presentOperationalAssessment(null, 'No source.'),
    })
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    expect(document.querySelector('.briefing-chart svg')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Current M&B notifications')
    expect(document.body.textContent).not.toContain('Profile and source status')
    expect(document.body.textContent).not.toContain('Applicable category limits')
    expect(document.body.textContent).toContain('MTOM:')
    input.performance = { ...input.performance, inputKey: change }
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')?.hasAttribute('data-print-invalid')).toBe(true)
    await nextTick()
    expect(document.body.textContent).not.toContain('500.0 kg')
    document.querySelector<HTMLButtonElement>('.mb-print-controls button')!.click()
    await nextTick()
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('500.0 kg')
    expect(document.querySelector('.mb-print-root')?.hasAttribute('data-print-invalid')).toBe(false)
    wrapper.unmount()
  })
  it('cancels without changing preparation and rechecks expiry before native Print', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02'))
    const input = source()
    input.profile!.status = 'verified'
    input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'T', pohRevision: 'Test', sourceWeighingDate: '2026-01-01' }
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const before = JSON.stringify(input)
    await wrapper.get('button').trigger('click')
    document.querySelectorAll<HTMLButtonElement>('.mb-print-controls button')[1]!.click()
    expect(print).toHaveBeenCalledOnce()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(JSON.stringify(input)).toBe(before)
    await wrapper.get('button').trigger('click')
    vi.setSystemTime(new Date('2026-11-14'))
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('500.0 kg')
    wrapper.unmount()
    vi.useRealTimers()
  })
  it.each([['draft', ' [UNVERIFIED]'], ['verified', '']] as const)('marks corrected distances for %s profiles', async (status, marker) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02'))
    const input = source()
    input.profile!.status = status
    input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'T', pohRevision: 'Synthetic', sourceWeighingDate: '2026-01-01' }
    const performance = presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: { status: 'unavailable', reason: 'x' }, landing: { status: 'unavailable', reason: 'x' },
      assessment: null, pressureAltitudeBasis: '', pendingReason: 'x', runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x') })
    input.performance = { ...performance, corrected: [{ operation: 'takeoff', title: 'Takeoff', status: 'applied', source: 'Synthetic',
      rows: [{ label: 'Ground roll', factored: '300 m ESTIMATED', raw: '200 m', corrected: '250 m ESTIMATED' }],
      safetyFactor: '1.20', safetyFactorWarning: 'Warning', comparison: { status: 'unavailable', reason: 'No runway' }, notes: ['Estimate source'] }] } as never
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain(`300 m ESTIMATED${marker} (raw 200 m${marker}, corrected 250 m ESTIMATED${marker})`)
    expect(document.body.textContent).toContain('Estimate source')
    expect(document.body.textContent).toContain('Warning')
    wrapper.unmount()
    vi.useRealTimers()
  })
  it('renders the unverified, low-margin and legal disclaimers with their exact wording', async () => {
    const input = source()
    const applied = { operation: 'takeoff', title: 'Takeoff', status: 'applied', source: 'Synthetic', rows: [], safetyFactor: '1.00',
      safetyFactorWarning: 'WARN-PF-002: low', comparison: { status: 'sufficient', summary: '', required: '', availableLabel: '', available: '', margin: '' }, notes: [] }
    const performance = { ...presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: { status: 'unavailable', reason: 'x' }, landing: { status: 'unavailable', reason: 'x' },
      assessment: null, pressureAltitudeBasis: '', pendingReason: 'x', runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x') }),
      corrected: [applied] }
    input.performance = performance as never
    expect(assembleMbPrint(input, new Date('2026-11-14'))!.lowSafetyMargin).toBe(true)
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    const text = document.body.textContent!
    expect(text).toContain('Calculation based on unverified external data. Pilot in Command assumes full responsibility.')
    expect(text).toContain('Calculation based on low safety margin. Pilot in Command assumes full responsibility.')
    expect(text).toContain('NO CERTIFIED AVIATION DEVICE')
    wrapper.unmount()
    const clean = source()
    clean.performance = { ...performance, corrected: [{ ...applied, safetyFactorWarning: null }] } as never
    expect(assembleMbPrint(clean, new Date('2026-11-14'))!.lowSafetyMargin).toBe(false)
  })
  describe('CRIT-UI-001 export gate', () => {
    const buttonByText = (t: string) => [...document.querySelectorAll('button')].find(b => b.textContent === t)!
    it('blocks print with unverified data, lists fields, and prints after acknowledgment', async () => {
      const wrapper = mount(MbPrintPreview, { props: { source: source() }, attachTo: document.body })
      const print = vi.spyOn(window, 'print').mockImplementation(() => {})
      await wrapper.get('button').trigger('click')
      buttonByText('Print Briefing Pack').click()
      await nextTick()
      expect(print).not.toHaveBeenCalled()
      const gate = document.querySelector('[role="alertdialog"]')!
      expect(gate.textContent).toContain('CRIT-UI-001')
      expect(gate.textContent).toContain('aircraft.profile.status')
      buttonByText('Acknowledge unverified data and print').click()
      await nextTick()
      expect(print).toHaveBeenCalledOnce()
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(document.body.textContent).toContain('500.0 kg [UNVERIFIED]')
      wrapper.unmount()
    })
    it('blocks native print until acknowledged and keeps the preview closed to cancel', async () => {
      const wrapper = mount(MbPrintPreview, { props: { source: source() }, attachTo: document.body })
      await wrapper.get('button').trigger('click')
      window.dispatchEvent(new Event('beforeprint'))
      expect(document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')).toBe('true')
      wrapper.unmount()
    })
    it('passes without a gate when nothing is unverified', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-02'))
      const input = source()
      input.profile!.status = 'verified'
      input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'T', pohRevision: 'Test', sourceWeighingDate: '2026-01-01' }
      expect(unverifiedGate(assembleMbPrint(input, new Date())!)).toBeNull()
      const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
      const print = vi.spyOn(window, 'print').mockImplementation(() => {})
      await wrapper.get('button').trigger('click')
      buttonByText('Print Briefing Pack').click()
      expect(print).toHaveBeenCalledOnce()
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      wrapper.unmount()
      vi.useRealTimers()
    })
  })
})
