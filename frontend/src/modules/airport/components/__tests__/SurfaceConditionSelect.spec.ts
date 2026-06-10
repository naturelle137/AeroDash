// @UT-AP-VIEW-001@ (FROM: @IMP-AP-VIEW-001@)
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SurfaceConditionSelect from '../SurfaceConditionSelect.vue'

describe('SurfaceConditionSelect', () => {
  it('renders the paved condition list for a paved runway (REQ-AP-004)', () => {
    const wrapper = mount(SurfaceConditionSelect, {
      props: { base: 'paved', modelValue: null, selectId: 'sc' },
    })
    const labels = wrapper.findAll('option').map((o) => o.text())
    expect(labels).toContain('Dry')
    expect(labels).toContain('Standing Water')
    expect(labels.some((l) => l.includes('Long Grass'))).toBe(false)
  })

  it('renders the grass condition list for a grass runway', () => {
    const wrapper = mount(SurfaceConditionSelect, {
      props: { base: 'grass', modelValue: null, selectId: 'sc' },
    })
    const labels = wrapper.findAll('option').map((o) => o.text())
    expect(labels.some((l) => l.includes('Long Grass'))).toBe(true)
  })

  it('shows a required hint until a condition is selected', () => {
    const wrapper = mount(SurfaceConditionSelect, {
      props: { base: 'paved', modelValue: null, selectId: 'sc' },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('emits the selected id on change and hides the hint', async () => {
    const wrapper = mount(SurfaceConditionSelect, {
      props: { base: 'paved', modelValue: 'paved-dry', selectId: 'sc' },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.find('select').setValue('paved-wet')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['paved-wet'])
  })

  it('emits null when the placeholder option is re-selected', async () => {
    const wrapper = mount(SurfaceConditionSelect, {
      props: { base: 'paved', modelValue: 'paved-dry', selectId: 'sc' },
    })
    await wrapper.find('select').setValue('')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
  })
})
