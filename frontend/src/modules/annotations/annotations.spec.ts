import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { STORAGE_KEY, parseStored, validateDraft } from './annotations'
import { useAnnotationStore } from './annotation.store'
import AnnotationPanel from './AnnotationPanel.vue'

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })

describe('annotation validation and storage', () => {
  it('requires author and text within limits', () => {
    expect(validateDraft('', 'x')).toMatch(/author/i)
    expect(validateDraft('A', '  ')).toMatch(/note/i)
    expect(validateDraft('A', 'x'.repeat(501))).toMatch(/limited/)
    expect(validateDraft('A', 'ok')).toBeNull()
  })
  it('drops malformed stored entries and survives corrupt JSON', () => {
    expect(parseStored('{not json')).toEqual([])
    expect(parseStored(JSON.stringify([{ id: 1 }, null, 'x']))).toEqual([])
  })
  it('adds, edits, deletes and persists per aircraft', () => {
    const store = useAnnotationStore()
    expect(store.add('ac1', 'takeoff', ' CRI ', ' Watch the aft CG ')).toBeNull()
    expect(store.add('ac2', 'zeroFuel', 'CRI', 'Other')).toBeNull()
    expect(store.add('ac1', 'takeoff', '', 'x')).not.toBeNull()
    const [note] = store.forAircraft('ac1')
    expect(note).toMatchObject({ author: 'CRI', text: 'Watch the aft CG' })
    expect(store.update(note!.id, 'CRI', 'Edited')).toBeNull()
    expect(parseStored(localStorage.getItem(STORAGE_KEY))).toHaveLength(2)
    setActivePinia(createPinia())
    expect(useAnnotationStore().forAircraft('ac1')[0]!.text).toBe('Edited')
    useAnnotationStore().remove(note!.id)
    expect(useAnnotationStore().forAircraft('ac1')).toEqual([])
    expect(useAnnotationStore().forAircraft('ac2')).toHaveLength(1)
  })
})

describe('AnnotationPanel', () => {
  it('shows attributed notes as distinct from system warnings and supports add, edit, delete', async () => {
    const wrapper = mount(AnnotationPanel, { props: { aircraftId: 'ac1' } })
    await wrapper.get('input').setValue('CRI Meyer')
    await wrapper.get('textarea').setValue('Aft CG migration')
    await wrapper.get('form').trigger('submit')
    const item = wrapper.get('[data-testid="annotation-item"]')
    expect(item.text()).toContain('Instructor note on Takeoff')
    expect(item.text()).toContain('CRI Meyer (self-declared)')
    expect(wrapper.text()).toContain('never clears or changes a system warning')
    await item.findAll('button')[0]!.trigger('click')
    await wrapper.get('textarea').setValue('Edited text')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="annotation-item"]').text()).toContain('Edited text')
    await wrapper.get('[data-testid="annotation-item"]').findAll('button')[1]!.trigger('click')
    expect(wrapper.findAll('[data-testid="annotation-item"]')).toHaveLength(0)
  })
  it('rejects an empty note with a visible error', async () => {
    const wrapper = mount(AnnotationPanel, { props: { aircraftId: 'ac1' } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/author/i)
  })
})

  it('isolates performance anchors and aircraft across reload and editing', async () => {
    const store = useAnnotationStore()
    store.add('ac1', 'takeoff', 'CRI', 'CG note')
    store.add('ac1', 'takeoffDistance', 'CRI', 'Takeoff note')
    store.add('ac1', 'landingDistance', 'CRI', 'Landing note')
    store.add('ac2', 'landingDistance', 'Other', 'Other aircraft')
    setActivePinia(createPinia())
    const wrapper = mount(AnnotationPanel, { props: { aircraftId: 'ac1', performance: true } })
    expect(wrapper.text()).toContain('Takeoff note')
    expect(wrapper.text()).toContain('Landing note')
    expect(wrapper.text()).not.toContain('CG note')
    expect(wrapper.text()).not.toContain('Other aircraft')
    await wrapper.get('[data-testid="annotation-item"] button').trigger('click')
    await wrapper.get('textarea').setValue('Updated distance')
    await wrapper.get('form').trigger('submit')
    expect(parseStored(localStorage.getItem(STORAGE_KEY)).find(n => n.anchor === 'takeoffDistance')?.text).toBe('Updated distance')
    await wrapper.get('[data-testid="annotation-item"] button[aria-label^="Delete"]').trigger('click')
    expect(wrapper.text()).not.toContain('Updated distance')
  })

it('retains distinct warning snapshots per aircraft and allows editing after the warning disappears', async () => {
  const wrapper = mount(AnnotationPanel, { props: { aircraftId: 'ac1', warnings: ['CRIT-1 · MTOM Exceeded', 'WARN-2 · CG limit'] } })
  const options = wrapper.get('select').findAll('option')
  await wrapper.get('select').setValue(options.find(o => o.text().includes('MTOM Exceeded'))!.element.value)
  await wrapper.get('input').setValue('Instructor')
  await wrapper.get('textarea').setValue('Review loading')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.text()).toContain('Warning: CRIT-1 · MTOM Exceeded')
  await wrapper.setProps({ warnings: ['WARN-2 · CG limit'] })
  await wrapper.get('[data-testid="annotation-item"] button').trigger('click')
  await wrapper.get('textarea').setValue('Recheck loading')
  await wrapper.get('form').trigger('submit')
  setActivePinia(createPinia())
  expect(useAnnotationStore().forAircraft('ac1')[0]?.text).toBe('Recheck loading')
  expect(useAnnotationStore().forAircraft('ac2')).toEqual([])
  expect(parseStored(localStorage.getItem(STORAGE_KEY))).toHaveLength(1)
})
