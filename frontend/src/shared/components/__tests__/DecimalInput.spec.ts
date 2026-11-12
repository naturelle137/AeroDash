/**
 * Unit tests for DecimalInput.vue
 *
 * @see frontend/src/shared/components/DecimalInput.vue
 */


import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DecimalInput from '../DecimalInput.vue'

async function typeValue(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
  const input = wrapper.find('input')
  await input.setValue(value)
  await input.trigger('input')
}

describe('DecimalInput — decimal precision', () => {
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
  it('emits null on empty string when allowNull=true', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 5, allowNull: true },
    })
    await typeValue(wrapper, '')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toBeNull()
  })

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

  it('emits valid value when within min bound', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 0, min: 0 },
    })
    await typeValue(wrapper, '10')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toBe(10)
  })
})

describe('DecimalInput — forbidden characters & out-of-range rejection', () => {
  function rejections(wrapper: ReturnType<typeof mount>): { reason: string }[] {
    return (wrapper.emitted('reject') ?? []).map((e) => e[0] as { reason: string })
  }

  function values(wrapper: ReturnType<typeof mount>): unknown[] {
    return (wrapper.emitted('update:modelValue') ?? []).map((e) => e[0])
  }

  it('strips "e" and emits reject(invalid) instead of expanding "1e2" to 100', async () => {
    const wrapper = mount(DecimalInput, { props: { modelValue: null, allowNull: true } })
    await typeValue(wrapper, '1e2')

    expect(values(wrapper)).not.toContain(100)
    expect(rejections(wrapper).some((r) => r.reason === 'invalid')).toBe(true)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('12')
  })

  it('strips a leading "+" and flags it invalid', async () => {
    const wrapper = mount(DecimalInput, { props: { modelValue: null, allowNull: true } })
    await typeValue(wrapper, '+5')

    expect(rejections(wrapper).some((r) => r.reason === 'invalid')).toBe(true)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('5')
  })

  it('emits reject(min) and no value when the typed number is below min', async () => {
    const wrapper = mount(DecimalInput, { props: { modelValue: 10, min: 5 } })
    await typeValue(wrapper, '2')

    expect(values(wrapper)).not.toContain(2)
    expect(rejections(wrapper).some((r) => r.reason === 'min')).toBe(true)
  })

  it('emits reject(max) and no value when the typed number is above max', async () => {
    const wrapper = mount(DecimalInput, { props: { modelValue: 10, max: 100 } })
    await typeValue(wrapper, '150')

    expect(values(wrapper)).not.toContain(150)
    expect(rejections(wrapper).some((r) => r.reason === 'max')).toBe(true)
  })

  it('does not emit reject for a clean in-range value', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true, min: 0, max: 100 },
    })
    await typeValue(wrapper, '42')

    expect(wrapper.emitted('reject')).toBeFalsy()
    expect(values(wrapper)).toContain(42)
  })
})

describe('DecimalInput — external modelValue sync', () => {
  it('syncs rawString when parent resets modelValue to null', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: 42, allowNull: true },
    })
    await wrapper.setProps({ modelValue: null })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('syncs rawString when parent sets a new numeric modelValue', async () => {
    const wrapper = mount(DecimalInput, {
      props: { modelValue: null, allowNull: true },
    })
    await wrapper.setProps({ modelValue: 3.14 })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('3.14')
  })
})
