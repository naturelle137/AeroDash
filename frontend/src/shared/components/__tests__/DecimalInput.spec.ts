/**
 * Unit tests for DecimalInput.vue
 *
 * @see frontend/src/shared/components/DecimalInput.vue
 */

// @UT-UI-COMP-DECIMAL-001@ (FROM: @IMP-UI-COMP-DECIMAL-001@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DecimalInput from '../DecimalInput.vue'

async function typeValue(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
  const input = wrapper.find('input')
  await input.setValue(value)
  await input.trigger('input')
}

describe('DecimalInput — decimal precision', () => {
  // @UT-UI-COMP-DECIMAL-001@
  it('preserves precision when typing 1.105 (no trailing-zero strip)', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true },
    })
    await typeValue(wrapper, '1.105')
    // Raw string is preserved
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('1.105')
    // Emitted value is the correct float
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0]
    expect(lastEmit).toBeCloseTo(1.105, 5)
  })

  // @UT-UI-COMP-DECIMAL-002@
  it('preserves intermediate trailing dot while typing', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true },
    })
    await typeValue(wrapper, '1.')
    // Intermediate state — should NOT emit a new value
    const emitted = wrapper.emitted('update:modelValue') ?? []
    expect(emitted).toHaveLength(0)
    // Raw string preserved
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('1.')
  })
})

describe('DecimalInput — comma decimal separator', () => {
  // @UT-UI-COMP-DECIMAL-003@
  it('accepts comma as decimal separator and parses the same as dot', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true },
    })
    await typeValue(wrapper, '1,105')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0]
    expect(lastEmit).toBeCloseTo(1.105, 5)
  })
})

describe('DecimalInput — empty string / null', () => {
  // @UT-UI-COMP-DECIMAL-004@
  it('emits null on empty string when allowNull=true', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 5, allowNull: true },
    })
    await typeValue(wrapper, '')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toBeNull()
  })

  // @UT-UI-COMP-DECIMAL-005@
  it('emits 0 on empty string when allowNull=false', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 5, allowNull: false },
    })
    await typeValue(wrapper, '')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toBe(0)
  })
})

describe('DecimalInput — min enforcement', () => {
  // @UT-UI-COMP-DECIMAL-006@
  it('does not emit a value below min=0 while typing a negative number', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 0, min: 0 },
    })
    await typeValue(wrapper, '-5')
    // Should NOT have emitted -5
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const values = emitted.map((e) => e[0])
    expect(values).not.toContain(-5)
  })

  // @UT-UI-COMP-DECIMAL-007@
  it('emits valid value when within min bound', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 0, min: 0 },
    })
    await typeValue(wrapper, '10')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toBe(10)
  })
})

describe('DecimalInput — external modelValue sync', () => {
  // @UT-UI-COMP-DECIMAL-008@
  it('syncs rawString when parent resets modelValue to null', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 42, allowNull: true },
    })
    await wrapper.setProps({ modelValue: null })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  // @UT-UI-COMP-DECIMAL-009@
  it('syncs rawString when parent sets a new numeric modelValue', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true },
    })
    await wrapper.setProps({ modelValue: 3.14 })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('3.14')
  })
})
