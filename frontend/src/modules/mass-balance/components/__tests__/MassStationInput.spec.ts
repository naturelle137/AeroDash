import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MassStationInput from '../MassStationInput.vue'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

function makeStation(overrides: Partial<StationInput> = {}): StationInput {
  return {
    index: 0,
    name: 'Pilot',
    weight: 80,
    verified: false,
    mandatory: true,
    touched: true,
    ...overrides,
  }
}

describe('MassStationInput', () => {
  // ─── Rendering ──────────────────────────────────────────────────────────

  it('renders the station name as a label', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ name: 'Baggage' }) },
    })

    expect(wrapper.find('label').text()).toBe('Baggage')
  })

  it('binds the label for-attribute to the station index', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ index: 2 }) },
    })

    expect(wrapper.find('label').attributes('for')).toBe('station-2')
    expect(wrapper.find('input').attributes('id')).toBe('station-2')
  })

  it('displays the current station weight in the input field', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 42 }) },
    })

    expect((wrapper.find<HTMLInputElement>('input').element).value).toBe('42')
  })

  // ─── disabled class branch ───────────────────────────────────────────────

  it('applies the disabled CSS class when the disabled prop is true', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation(), disabled: true },
    })

    expect(wrapper.find('.mass-station-input--disabled').exists()).toBe(true)
  })

  it('does not apply the disabled CSS class when the disabled prop is false', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation(), disabled: false },
    })

    expect(wrapper.find('.mass-station-input--disabled').exists()).toBe(false)
  })

  it('does not apply the disabled CSS class when the disabled prop is absent', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation() },
    })

    expect(wrapper.find('.mass-station-input--disabled').exists()).toBe(false)
  })

  // ─── Decrement button — disabled branch (weight <= 0 || disabled) ────────

  it('disables the decrement button when weight is exactly 0', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    const [decrement] = wrapper.findAll('button')
    expect((decrement!.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables the decrement button when weight is above 0 and not disabled', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 5 }) },
    })

    const [decrement] = wrapper.findAll('button')
    expect((decrement!.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables the decrement button when the disabled prop is true even if weight > 0', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 50 }), disabled: true },
    })

    const [decrement] = wrapper.findAll('button')
    expect((decrement!.element as HTMLButtonElement).disabled).toBe(true)
  })

  // ─── Increment button — disabled branch ─────────────────────────────────

  it('disables the increment button when the disabled prop is true', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), disabled: true },
    })

    const buttons = wrapper.findAll('button')
    expect((buttons[1]!.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables the increment button when the disabled prop is false', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), disabled: false },
    })

    const buttons = wrapper.findAll('button')
    expect((buttons[1]!.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('also disables the input field when the disabled prop is true', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation(), disabled: true },
    })

    expect((wrapper.find<HTMLInputElement>('input').element).disabled).toBe(true)
  })

  // ─── decrement() emit ────────────────────────────────────────────────────

  it('emits update:weight with weight minus 1 when decrement is clicked', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 5 }) },
    })

    const [decrement] = wrapper.findAll('button')
    await decrement!.trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[4]])
  })

  it('clamps the emitted value to 0 when decrement is called with weight already at 0', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    // Button is disabled in DOM, call the method directly to exercise Math.max branch
    ;(wrapper.vm as unknown as { decrement(): void }).decrement()

    expect(wrapper.emitted('update:weight')).toEqual([[0]])
  })

  it('emits 0 when decrement is called with weight of 1', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 1 }) },
    })

    const [decrement] = wrapper.findAll('button')
    await decrement!.trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[0]])
  })

  // ─── increment() emit ────────────────────────────────────────────────────

  it('emits update:weight with weight plus 1 when increment is clicked', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 10 }) },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[11]])
  })

  it('emits 1 when increment is clicked with an initial weight of 0', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[1]])
  })

  // ─── onInput() — Number.isNaN branch ────────────────────────────────────

  it('emits update:weight with the parsed float when a valid number is typed', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    const onInput = (wrapper.vm as unknown as { onInput(e: Event): void }).onInput
    onInput.call(wrapper.vm, { target: { value: '75.5' } } as unknown as Event)

    expect(wrapper.emitted('update:weight')).toEqual([[75.5]])
  })

  it('does not emit update:weight when the input value is not a number', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    const onInput = (wrapper.vm as unknown as { onInput(e: Event): void }).onInput
    onInput.call(wrapper.vm, { target: { value: 'abc' } } as unknown as Event)

    expect(wrapper.emitted('update:weight')).toBeUndefined()
  })

  it('does not emit update:weight when the input value is an empty string', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    const onInput = (wrapper.vm as unknown as { onInput(e: Event): void }).onInput
    onInput.call(wrapper.vm, { target: { value: '' } } as unknown as Event)

    expect(wrapper.emitted('update:weight')).toBeUndefined()
  })
})
