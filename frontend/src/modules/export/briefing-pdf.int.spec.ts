import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import MbPrintPreview from './MbPrintPreview.vue'
import type { MbPrintSource } from './mb-print'
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
const expectedText = (): string => {
  const sheet = document.querySelector('.mb-print-sheet')!.cloneNode(true) as HTMLElement
  sheet.querySelectorAll('nav, svg, .briefing-gate').forEach(n => n.remove())
  sheet.querySelectorAll('p, li, h1, h2, h3, td, th, figcaption').forEach(n => n.append(' '))
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
    expect(strip(text)).toContain(strip('not a certified aviation device'))
    expect(strip(text)).toContain(strip('Loading envelope chart could not be embedded'))
    wrapper.unmount()
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
