import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANUAL_RUNWAY_STORAGE_KEY } from '../services/manual-runway.repository'
import ManualRunwayPanel from './ManualRunwayPanel.vue'

// Synthetic runway values; not a real aerodrome.
const valid = {
  '#manual-runway-aerodrome': 'TEST',
  '#manual-runway-designator': '27',
  '#manual-runway-tora': '2000',
  '#manual-runway-tora-unit': 'ft',
  '#manual-runway-lda': '550',
  '#manual-runway-lda-unit': 'm',
  '#manual-runway-elevation': '-12',
  '#manual-runway-elevation-unit': 'ft',
  '#manual-runway-surface-type': 'paved',
  '#manual-runway-surface-condition': 'wet',
} as const

async function fill(view: VueWrapper, values: Partial<Record<keyof typeof valid, string>> = valid) {
  for (const [selector, value] of Object.entries(values)) await view.get(selector).setValue(value)
}
const summary = (view: VueWrapper) => view.find('[aria-label="Saved manual runway"]')

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => { vi.restoreAllMocks() })

describe('ManualRunwayPanel', () => {
  it('starts empty without default surface or units and blocks saving', async () => {
    const view = mount(ManualRunwayPanel)
    for (const selector of Object.keys(valid)) expect((view.get(selector).element as HTMLInputElement).value).toBe('')
    expect(view.get('#manual-runway-surface-condition').attributes('disabled')).toBeDefined()
    await view.get('form').trigger('submit')
    expect(view.get('[role="alert"]').text()).toContain('correct 10 fields')
    expect(view.findAll('.field-error')).toHaveLength(10)
    expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBeNull()
    expect(summary(view).exists()).toBe(false)
    expect(view.text()).toContain('Runway assessment unavailable')
    expect(view.text()).toContain('not validated against airport data')
  })

  it('saves original values and units, shows provenance and conversions, and restores after reload', async () => {
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('form').trigger('submit')
    const stored = JSON.parse(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)!)
    expect(stored.schemaVersion).toBe(1)
    expect(stored.runway.tora).toEqual({ value: 2000, unit: 'ft' })
    expect(stored.runway.lda).toEqual({ value: 550, unit: 'm' })
    expect(stored.runway.fieldElevation).toEqual({ value: -12, unit: 'ft' })
    expect(summary(view).text()).toContain('2000 ft (609.6 m)')
    expect(summary(view).text()).toContain('550 m (550.0 m)')
    expect(summary(view).text()).toContain('-12 ft (-3.7 m)')
    expect(summary(view).text()).toContain('Paved · Wet')
    expect(summary(view).text()).toContain('User-entered, not airport-validated')
    view.unmount()

    setActivePinia(createPinia())
    const reloaded = mount(ManualRunwayPanel)
    expect((reloaded.get('#manual-runway-tora-unit').element as HTMLSelectElement).value).toBe('ft')
    expect((reloaded.get('#manual-runway-lda-unit').element as HTMLSelectElement).value).toBe('m')
    expect((reloaded.get('#manual-runway-surface-condition').element as HTMLSelectElement).value).toBe('wet')
    expect(summary(reloaded).text()).toContain('2000 ft (609.6 m)')
  })

  it('immediately hides the saved summary on any edit and restores it on discard', async () => {
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('form').trigger('submit')
    for (const [selector, value] of [
      ['#manual-runway-tora', '2001'], ['#manual-runway-tora-unit', 'm'], ['#manual-runway-lda', '551'],
      ['#manual-runway-elevation', '0'], ['#manual-runway-designator', '09'],
      ['#manual-runway-surface-condition', 'dry'],
    ] as const) {
      await view.get(selector).setValue(value)
      expect(summary(view).exists()).toBe(false)
      expect(view.text()).toContain('Unsaved changes')
      await view.get('button[type="button"]').trigger('click')
      expect(summary(view).exists()).toBe(true)
    }
  })

  it('clears a condition from another surface family when the type changes', async () => {
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('#manual-runway-surface-type').setValue('unpaved')
    expect((view.get('#manual-runway-surface-condition').element as HTMLSelectElement).value).toBe('')
    await view.get('form').trigger('submit')
    expect(view.text()).toContain('Select the surface condition.')
    expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBeNull()
  })

  it.each([['0'], ['-5'], ['NaN'], ['Infinity'], ['']])('keeps a previous save but shows no current runway for LDA %j', async (lda) => {
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('form').trigger('submit')
    const before = localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)
    await view.get('#manual-runway-lda').setValue(lda)
    await view.get('form').trigger('submit')
    expect(view.get('#manual-runway-lda').attributes('aria-invalid')).toBe('true')
    expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBe(before)
    expect(summary(view).exists()).toBe(false)
  })

  it.each([
    ['damaged JSON', '{oops', 'damaged or invalid'],
    ['tampered values', JSON.stringify({ schemaVersion: 1, savedAt: '2026-11-12T10:00:00.000Z', runway: { aerodrome: 'TEST' } }), 'damaged or invalid'],
    ['future version', JSON.stringify({ schemaVersion: 7, savedAt: '2026-11-12T10:00:00.000Z', runway: {} }), 'newer format version 7'],
  ])('visibly ignores %s storage and lets the pilot clear it', async (_name, raw, message) => {
    localStorage.setItem(MANUAL_RUNWAY_STORAGE_KEY, raw)
    const view = mount(ManualRunwayPanel)
    expect(view.get('[role="alert"]').text()).toContain(message)
    expect(summary(view).exists()).toBe(false)
    expect((view.get('#manual-runway-tora').element as HTMLInputElement).value).toBe('')
    await view.findAll('button').find((button) => button.text() === 'Clear runway inputs')!.trigger('click')
    expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBeNull()
    expect(view.find('[role="alert"]').exists()).toBe(false)
  })

  it('reports a storage write failure and does not show the runway as saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('form').trigger('submit')
    expect(view.get('[role="alert"]').text()).toContain('Could not save manual runway inputs')
    expect(summary(view).exists()).toBe(false)
  })

  it('reports unavailable storage on load', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    const view = mount(ManualRunwayPanel)
    expect(view.get('[role="alert"]').text()).toContain('Browser storage is unavailable')
  })

  it('clears the saved runway and form', async () => {
    const view = mount(ManualRunwayPanel)
    await fill(view)
    await view.get('form').trigger('submit')
    await view.findAll('button').find((button) => button.text() === 'Clear runway inputs')!.trigger('click')
    expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBeNull()
    expect(summary(view).exists()).toBe(false)
    expect((view.get('#manual-runway-tora').element as HTMLInputElement).value).toBe('')
    expect(view.text()).toContain('cleared from this device')
  })
})
