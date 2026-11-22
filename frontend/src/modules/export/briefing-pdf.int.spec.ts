import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import MbPrintPreview from './MbPrintPreview.vue'
import type { MbPrintSource } from './mb-print'
import { disclaimerBlocks } from './disclaimer-text'
import { usePerformanceStep } from '@/modules/performance/composables/performance-step'
import { presentOperationalAssessment, presentPerformance } from '@/modules/performance/services/performance-presentation'
import { buildPdf, toLatin1, wrap, textWidth } from './briefing-pdf'

function source(verified = false): MbPrintSource {
  setActivePinia(createPinia())
  const profile = testPohAircraft()
  profile.status = 'draft'
  if (verified) {
    profile.status = 'verified'
    profile.verification = { verifiedOn: '2026-01-01', verifiedBy: 'T', pohRevision: 'Test', sourceWeighingDate: '2026-01-01' }
  }
  const store = useMassBalanceStore()
  store.loadProfile(mapFleetProfileToContext(profile))
  return reactive({ state: store.uiState, ready: true, profile, aircraft: store.aircraft,
    category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI, stations: store.availableStations,
    notifications: store.notifications })
}
const buttonByText = (t: string) => [...document.querySelectorAll('button')].find(b => b.textContent === t)!
const words = (s: string): string[] => toLatin1(s).split(/\s+/).filter(Boolean).sort()
const strip = (s: string) => s.replace(/\s+/g, '')
const readBlob = (blob: Blob) => new Promise<Uint8Array>(resolve => {
  const reader = new FileReader()
  reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
  reader.readAsArrayBuffer(blob)
})
// Content streams are uncompressed, so text-show operators can be read back directly.
function pdfText(bytes: Uint8Array): string {
  const raw = [...bytes].map(b => String.fromCharCode(b)).join('')
  return [...raw.matchAll(/\((.*)\) Tj ET/g)].map(m => m[1]!.replace(/\\([\\()])/g, '$1')).join(' ')
}
const expectedText = (): string[] => {
  const sheet = document.querySelector('.mb-print-sheet')!.cloneNode(true) as HTMLElement
  sheet.querySelectorAll('nav, svg, .briefing-gate').forEach(n => n.remove())
  sheet.querySelectorAll('p, li, h1, h2, h3, td, th, figcaption').forEach(n => { n.before(' '); n.append(' ') })
  return words(sheet.textContent ?? '')
}

describe('Briefing Pack PDF download', () => {
  let blobs: Blob[]
  let clicks: string[]
  beforeEach(() => {
    blobs = []
    clicks = []
    URL.createObjectURL = vi.fn<(b: Blob) => string>((b) => { if (b.type === 'application/pdf') blobs.push(b); return 'blob:test' })
    URL.revokeObjectURL = vi.fn<(u: string) => void>()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download) })
    // jsdom cannot decode SVG; the chart then degrades to a stated omission.
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_: string) { queueMicrotask(() => this.onerror?.()) } })
  })
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('blocks the download until the unverified-data gate is acknowledged, then carries snapshot text and markers', async () => {
    const wrapper = mount(MbPrintPreview, { props: { source: source() }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    buttonByText('Download PDF').click()
    await nextTick()
    expect(blobs).toHaveLength(0)
    const gate = document.querySelector('[role="alertdialog"]')!
    expect(gate.textContent).toContain('CRIT-UI-001')
    expect(gate.textContent).toContain('The PDF download proceeds only after')
    buttonByText('Acknowledge unverified data and download PDF').click()
    await vi.waitFor(() => expect(blobs).toHaveLength(1))
    expect(blobs[0]!.type).toBe('application/pdf')
    expect(clicks[0]).toMatch(/^aerodash-briefing-pack-\d{12}\.pdf$/)
    const bytes = await readBlob(blobs[0]!)
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe('%PDF-1.4')
    const text = pdfText(bytes)
    // Parity with the print snapshot: the file holds exactly the words of the rendered sheet (table cells are laid
    // out column-wise, hence an order-insensitive comparison) plus the stated chart omission.
    const note = 'Loading envelope chart could not be embedded in this PDF; refer to the M&B results table.'
    expect(words(text)).toEqual([...expectedText(), ...words(note)].sort())
    expect(text).toContain('[UNVERIFIED]')
    expect(strip(text)).toContain(strip('Calculation based on unverified external data. Pilot in Command assumes full responsibility.'))
    expect(strip(text)).toContain(strip('NO CERTIFIED AVIATION DEVICE'))
    expect(strip(text)).toContain(strip('Loading envelope chart could not be embedded'))
    const blocks = disclaimerBlocks()
    expect(blocks.length).toBeGreaterThan(10)
    for (const b of blocks) expect(strip(text)).toContain(strip(toLatin1(b.text)))
    expect(strip(text)).toContain(strip('The official handbook always takes precedence.'))
    expect(strip(text)).toContain(strip('Keine Gewährleistung'))
    wrapper.unmount()
  })

  async function pdfFor(input: MbPrintSource): Promise<{ text: string; sheet: string }> {
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    buttonByText('Download PDF').click()
    await nextTick()
    buttonByText('Acknowledge unverified data and download PDF').click()
    await vi.waitFor(() => expect(blobs).toHaveLength(1))
    const text = pdfText(await readBlob(blobs[0]!))
    const sheet = document.querySelector('.mb-print-sheet')!.textContent!
    wrapper.unmount()
    return { text, sheet }
  }

  it('preserves aggregate CG warnings at trajectory level in the PDF', async () => {
    const input = source()
    input.notifications.push({ id: 'CRIT-MB-003', severity: 'WARNING', message: 'CG Migration Limit Exceeded', context: 'MassBalance.CG', persistent: false, dismissible: true })
    const { text } = await pdfFor(input)
    const results = text.split('M&B results')[1]!.split('Loading envelope chart')[0]!
    expect(results.split('CG trajectory warnings')[0]).not.toContain('CG Migration Limit Exceeded')
    expect(results.split('CG trajectory warnings')[1]).toContain('CG Migration Limit Exceeded')
  })

  it('exports condition and factor warnings beside corrected distances', async () => {
    const input = source()
    const base = presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: { status: 'unavailable', reason: 'x' }, landing: { status: 'unavailable', reason: 'x' }, assessment: null, pressureAltitudeBasis: '', pendingReason: 'x', runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x') })
    input.performance = { ...base, groups: [{ id: 'takeoff', title: 'Takeoff', mass: null, status: 'success', reason: null, rows: [{ label: 'Ground roll', value: '100 m', note: null, warnings: ['QNH advisory', 'Temperature advisory'] }] }], corrected: [{ operation: 'takeoff', title: 'Takeoff', status: 'applied', source: 'Synthetic', partial: false, rows: [{ label: 'Ground roll', raw: '100 m', corrected: '110 m', factored: '120 m' }], safetyFactor: '1.10', safetyFactorWarning: 'Low factor', comparison: { status: 'unavailable', summary: '', required: '', availableLabel: '', available: '', margin: '' }, notes: [] }] }
    const { text } = await pdfFor(input)
    const corrected = text.split('Takeoff corrected distances')[1]!.split('Safety factor:')[0]!
    for (const warning of ['QNH advisory', 'Temperature advisory', 'Low factor']) expect(corrected).toContain(warning)
    expect(corrected).toContain('120 m')
  })

  it.each([false, true])('carries the extrapolation warning, details and estimate markers (acknowledged: %s)', async (acknowledged) => {
    const input = source()
    const scope = effectScope()
    scope.run(() => {
      const step = usePerformanceStep(() => ({ ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
        takeoff: { status: 'ready', massKg: 1050, origin: 'M&B' }, landing: { status: 'ready', massKg: 850, origin: 'trip arrival' } }))
      step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
      step.extrapolationAcknowledged.value = acknowledged
      input.performance = JSON.parse(JSON.stringify(step.presentation.value))
    })
    scope.stop()
    const { text, sheet } = await pdfFor(input)
    expect(sheet).toContain('Extrapolated performance data')
    expect(strip(text)).toContain(strip('boundary distance carries a fixed +20 % penalty'))
    expect(strip(text)).toContain(strip('mass 1,050.0 kg is 5.0 % above the table maximum 1,000.0 kg'))
    expect(strip(text)).toContain(strip(acknowledged ? 'Acknowledged by the pilot in command.' : 'Not acknowledged by the pilot in command'))
    expect(strip(text).includes(strip('ESTIMATED - EXTRAPOLATED (+20 % penalty)'))).toBe(acknowledged)
    expect(text.includes('384.0 m')).toBe(acknowledged)
  })

  it('carries the ESTIMATED (CAA SSL 07) marker of a distance row', async () => {
    const input = source()
    const base = presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: { status: 'unavailable', reason: 'x' }, landing: { status: 'unavailable', reason: 'x' },
      assessment: null, pressureAltitudeBasis: '', pendingReason: 'x', runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x'), notifications: [] })
    input.performance = { ...base, groups: [{ id: base.groups[0]!.id, title: 'Take-off', mass: null, status: 'success', reason: null,
      rows: [{ label: 'Ground roll', value: '300 m', note: 'ESTIMATED (CAA SSL 07)' }] }] }
    const { text, sheet } = await pdfFor(input)
    expect(sheet).toContain('ESTIMATED (CAA SSL 07)')
    expect(strip(text)).toContain(strip('ESTIMATED (CAA SSL 07)'))
  })

  it('carries lower-axis estimate markers from the live performance calculation into the PDF', async () => {
    const input = source()
    const scope = effectScope()
    scope.run(() => {
      const step = usePerformanceStep(() => ({ ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
        takeoff: { status: 'ready', massKg: 900, origin: 'M&B' }, landing: { status: 'ready', massKg: 850, origin: 'trip arrival' } }))
      step.pa.method.value = 'direct'; step.pa.direct.value = '-1'; step.temperature.value = '-1'
      input.performance = JSON.parse(JSON.stringify(step.presentation.value))
    })
    scope.stop()
    const { text, sheet } = await pdfFor(input)
    expect(sheet).toContain('ESTIMATED (lower-axis table boundary)')
    expect(strip(text)).toContain(strip('ESTIMATED (lower-axis table boundary)'))
  })

  it('carries the runway-insufficient and low-safety-factor notifications', async () => {
    const input = source()
    input.performance = presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: { status: 'unavailable', reason: 'x' }, landing: { status: 'unavailable', reason: 'x' },
      assessment: null, pressureAltitudeBasis: '', pendingReason: 'x', runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x'),
      notifications: [
        { id: 'CRIT-PF-002', severity: 'CRITICAL', message: 'Takeoff: runway insufficient.', context: 'Performance.RunwayLength', persistent: true, dismissible: false },
        { id: 'WARN-PF-002', severity: 'WARNING', message: 'Takeoff: low safety factor.', context: 'Performance.SafetyFactor', persistent: true, dismissible: true },
      ] })
    const { text } = await pdfFor(input)
    expect(strip(text)).toContain(strip('CRITICAL · CRIT-PF-002: Takeoff: runway insufficient.'))
    expect(strip(text)).toContain(strip('WARNING · WARN-PF-002: Takeoff: low safety factor.'))
  })

  it('downloads directly when nothing is unverified', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-02'))
    const wrapper = mount(MbPrintPreview, { props: { source: source(true) }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    buttonByText('Download PDF').click()
    await vi.waitFor(() => expect(blobs).toHaveLength(1))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('includes the unapproved handover label in the local PDF', async () => {
    const wrapper = mount(MbPrintPreview, { props: { source: source() }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    buttonByText('Prepare unapproved handover copy').click()
    await nextTick()
    expect(document.querySelector('.mb-print-sheet')?.textContent).toContain('Student handover copy — UNAPPROVED')
    const input = document.querySelector<HTMLInputElement>('input[type=text]')!
    input.value = 'A. Student'
    input.dispatchEvent(new Event('input'))
    const note = document.querySelector<HTMLTextAreaElement>('textarea')!
    note.value = 'Check fuel reserve'
    note.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.querySelector('.mb-print-sheet')?.textContent).toContain('Prepared by (self-declared, unverified): A. Student')
    expect(document.querySelector('.mb-print-sheet')?.textContent).toContain('Signature:')
    expect(document.querySelector('.mb-print-sheet')?.textContent).toContain('Handover note (self-declared, unverified): Check fuel reserve')
    buttonByText('Download PDF').click()
    await nextTick()
    buttonByText('Acknowledge unverified data and download PDF').click()
    await vi.waitFor(() => expect(blobs).toHaveLength(1))
    expect(strip(pdfText(await readBlob(blobs[0]!)))).toContain(strip('Student handover copy - UNAPPROVED. Instructor review and authenticated counter-signature are not recorded by AeroDash.'))
    expect(strip(pdfText(await readBlob(blobs[0]!)))).toContain(strip('Check fuel reserve'))
    wrapper.unmount()
  })

  it('creates no file when the snapshot was invalidated', async () => {
    const input = source()
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    input.aircraft!.registration = 'D-NEXT'
    await nextTick()
    expect(buttonByText('Download PDF').disabled).toBe(true)
    buttonByText('Download PDF').click()
    await nextTick()
    expect(blobs).toHaveLength(0)
    expect(clicks).toHaveLength(0)
    wrapper.unmount()
  })

  it('creates no file when inputs change while the PDF is rendered', async () => {
    const input = source()
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    buttonByText('Download PDF').click()
    await nextTick()
    buttonByText('Acknowledge unverified data and download PDF').click()
    input.aircraft!.registration = 'D-NEXT'
    await new Promise(r => setTimeout(r, 20))
    expect(blobs).toHaveLength(0)
    expect(document.body.textContent).toContain('Preview invalidated')
    wrapper.unmount()
  })
})

describe('PDF writer', () => {
  it('maps non-Latin-1 glyphs visibly and wraps within the line width', () => {
    expect(toLatin1('≤ 5 kg → ok · 20°')).toBe('<= 5 kg -> ok · 20°')
    expect(toLatin1('日')).toBe('?')
    const lines = wrap('word '.repeat(60), 10, 200)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every(l => textWidth(l, 10) <= 200)).toBe(true)
    expect(wrap('x'.repeat(200), 10, 100).every(l => textWidth(l, 10) <= 100)).toBe(true)
  })
  it('splits a row taller than a page without losing any line', () => {
    const long = Array.from({ length: 500 }, (_, i) => `Station${i}`).join(' ')
    const bytes = buildPdf([{ kind: 'row', cells: [long, 'WARN-END'] }], [], 'T')
    const raw = [...bytes].map(b => String.fromCharCode(b)).join('')
    expect(raw).toMatch(/\/Count [2-9]/)
    const ys = [...raw.matchAll(/ Td \(/g)].length
    expect(ys).toBeGreaterThan(50)
    for (const m of raw.matchAll(/BT \/F\d [\d.]+ Tf [\d.]+ (-?[\d.]+) Td/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(42)
    const text = pdfText(bytes)
    for (let i = 0; i < 500; i++) expect(text).toContain(`Station${i}`)
    expect(text).toContain('WARN-END')
  })
  it('paginates, escapes parentheses and writes a consistent xref', () => {
    const blocks = Array.from({ length: 120 }, (_, i) => ({ kind: 'text' as const, text: `Line (${i}) \\ end` }))
    const bytes = buildPdf(blocks, [], 'T')
    const raw = [...bytes].map(b => String.fromCharCode(b)).join('')
    expect(raw).toMatch(/\/Count [2-9]/)
    expect(raw).toContain('Line \\(0\\) \\\\ end')
    const start = Number(/startxref\n(\d+)/.exec(raw)![1])
    expect(raw.slice(start, start + 4)).toBe('xref')
    const entries = [...raw.slice(start).matchAll(/(\d{10}) 00000 n/g)]
    for (const [i, e] of entries.entries()) expect(raw.slice(Number(e[1]), Number(e[1]) + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
  })
})
