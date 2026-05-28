// @UT-MB-UI-001@ (FROM: @IMP-MB-UI-006@, @IMP-MB-UI-008@)

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MassStationInput from '../MassStationInput.vue'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

/** The sanitised decimal field rendered by the embedded DecimalInput. */
function field(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('input[type="text"]')
}

/** Numeric values carried by every emitted `update:weight`. */
function weightEmissions(wrapper: ReturnType<typeof mount>): unknown[] {
  return (wrapper.emitted('update:weight') ?? []).map((e) => e[0])
}

function makeStation(overrides: Partial<StationInput> = {}): StationInput {
  return {
    index: 0,
    name: 'Pilot',
    weight: 80,
    verified: false,
    mandatory: true,
    touched: true,
    hasError: false,
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

    const decrement = wrapper.find('button[aria-label="Decrease"]')
    expect((decrement.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables the decrement button when weight is above 0 and not disabled', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 5 }) },
    })

    const decrement = wrapper.find('button[aria-label="Decrease"]')
    expect((decrement.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables the decrement button when the disabled prop is true even if weight > 0', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 50 }), disabled: true },
    })

    const decrement = wrapper.find('button[aria-label="Decrease"]')
    expect((decrement.element as HTMLButtonElement).disabled).toBe(true)
  })

  // ─── Increment button — disabled branch ─────────────────────────────────

  it('disables the increment button when the disabled prop is true', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), disabled: true },
    })

    const increment = wrapper.find('button[aria-label="Increase"]')
    expect((increment.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables the increment button when the disabled prop is false', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), disabled: false },
    })

    const increment = wrapper.find('button[aria-label="Increase"]')
    expect((increment.element as HTMLButtonElement).disabled).toBe(false)
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

    await wrapper.find('button[aria-label="Decrease"]').trigger('click')

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

    await wrapper.find('button[aria-label="Decrease"]').trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[0]])
  })

  // ─── increment() emit ────────────────────────────────────────────────────

  it('emits update:weight with weight plus 1 when increment is clicked', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 10 }) },
    })

    await wrapper.find('button[aria-label="Increase"]').trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[11]])
  })

  it('emits 1 when increment is clicked with an initial weight of 0', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await wrapper.find('button[aria-label="Increase"]').trigger('click')

    expect(wrapper.emitted('update:weight')).toEqual([[1]])
  })

  // ─── Decimal field entry (via the embedded DecimalInput) ─────────────────

  it('emits update:weight with the parsed float when a valid number is typed', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await field(wrapper).setValue('75.5')

    expect(weightEmissions(wrapper)).toContain(75.5)
  })

  it('does not emit a weight when only non-numeric characters are typed', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await field(wrapper).setValue('abc')

    expect(wrapper.emitted('update:weight')).toBeUndefined()
  })

  it('emits the floor weight when the field is cleared', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 50 }) },
    })

    await field(wrapper).setValue('')

    expect(weightEmissions(wrapper)).toEqual([0])
  })

  it('exposes the field as a sanitised decimal input, never type=number', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation() },
    })

    const input = field(wrapper)
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('decimal')
  })

  // ─── UX-002: coarse step + presets + wider field ────────────────────────

  it('renders coarse +/- controls in addition to the fine +/- control', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 80 }), unit: 'kg' },
    })

    const coarse = wrapper.findAll('.mass-station-input__stepper--coarse')
    // One coarse decrease + one coarse increase.
    expect(coarse).toHaveLength(2)
    // Fine controls are retained (the original ± buttons still exist).
    expect(wrapper.find('button[aria-label="Decrease"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Increase"]').exists()).toBe(true)
  })

  it('defaults the coarse step to 5 for kilograms', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 80 }), unit: 'kg' },
    })

    await wrapper.find('button[aria-label="Increase by 5"]').trigger('click')
    expect(wrapper.emitted('update:weight')).toEqual([[85]])
  })

  it('defaults the coarse step to 10 for pounds', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 80 }), unit: 'lb' },
    })

    await wrapper.find('button[aria-label="Increase by 10"]').trigger('click')
    expect(wrapper.emitted('update:weight')).toEqual([[90]])
  })

  it('honours an explicit coarseStep prop', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 80 }), unit: 'kg', coarseStep: 25 },
    })

    await wrapper.find('button[aria-label="Increase by 25"]').trigger('click')
    expect(wrapper.emitted('update:weight')).toEqual([[105]])
  })

  it('coarse decrement clamps to the minimum (unusable fuel)', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 6 }), unit: 'kg', unusableFuel: 3 },
    })

    // 6 - 5 = 1, clamped up to the 3 kg unusable floor.
    await wrapper.find('button[aria-label="Decrease by 5"]').trigger('click')
    expect(wrapper.emitted('update:weight')).toEqual([[3]])
  })

  it('reaches a 75 kg passenger in far fewer taps via the coarse step', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), unit: 'kg', coarseStep: 25 },
    })
    const coarseUp = wrapper.find('button[aria-label="Increase by 25"]')

    // 3 coarse taps would be 75 (vs 75 fine taps) — prove the first emits 25.
    await coarseUp.trigger('click')
    const emissions = wrapper.emitted('update:weight')!
    expect(emissions[emissions.length - 1]).toEqual([25])
  })

  it('does not render preset chips when no presets are provided', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation(), unit: 'kg' },
    })
    expect(wrapper.find('.mass-station-input__presets').exists()).toBe(false)
  })

  // ─── REQ-UQ-005 — Unit-Sticky Label (Safety-Critical Design Check) ──────

  // @UT-MB-UI-002@ (FROM: @IMP-MB-UI-007@, @REQ-UQ-005@, @H-001@, @H-002@)
  it('renders the active unit statically next to the station label', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ name: 'Pilot' }), unit: 'kg' },
    })

    const unitLabel = wrapper.find('.mass-station-input__unit')
    expect(unitLabel.exists()).toBe(true)
    expect(unitLabel.text()).toBe('kg')
    expect(unitLabel.attributes('aria-label')).toBe('unit')
  })

  // @UT-MB-UI-002@ (FROM: @IMP-MB-UI-007@, @REQ-UQ-005@)
  it('omits the unit chip only when no unit prop is supplied', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation() },
    })
    expect(wrapper.find('.mass-station-input__unit').exists()).toBe(false)
  })

  // @UT-MB-UI-002@ (FROM: @IMP-MB-UI-007@, @REQ-UQ-005@)
  it('reflects an imperial mass unit (lb) on the static unit chip', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ name: 'Front Seats' }), unit: 'lb' },
    })
    expect(wrapper.find('.mass-station-input__unit').text()).toBe('lb')
  })

  it('renders one preset chip per provided preset and emits its value on tap', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }), unit: 'kg', presets: [55, 70, 85] },
    })

    const chips = wrapper.findAll('.mass-station-input__preset-chip')
    expect(chips).toHaveLength(3)
    expect(chips[1]!.text()).toContain('70')

    await chips[1]!.trigger('click')
    expect(wrapper.emitted('update:weight')).toEqual([[70]])
  })

  it('disables coarse controls and preset chips when the disabled prop is true', () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 80 }), unit: 'kg', disabled: true, presets: [70] },
    })

    const coarse = wrapper.findAll('.mass-station-input__stepper--coarse')
    expect(coarse.every((b) => (b.element as HTMLButtonElement).disabled)).toBe(true)
    expect(
      (wrapper.find('.mass-station-input__preset-chip').element as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

// ─── UX-010 / UX-011: sanitised decimal entry + inline rejection feedback ───
// @UT-MB-UI-003@ (FROM: @IMP-MB-UI-009@)
describe('MassStationInput — "e"/out-of-range rejection feedback', () => {
  it('never expands "1e2" to 100 — the "e" is rejected, so no such weight is emitted', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await field(wrapper).setValue('1e2')

    // The native type=number defect silently parsed "1e2" as 100; it must not recur.
    expect(weightEmissions(wrapper)).not.toContain(100)
  })

  it('shows a transient inline hint and error border when a forbidden character is blocked', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await field(wrapper).setValue('1e2')

    const hint = wrapper.find('.mass-station-input__reject-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text().toLowerCase()).toContain('digits')
    expect(wrapper.find('.mass-station-input--rejected').exists()).toBe(true)
  })

  it('rejects a value above the station capacity with a "Maximum is …" hint and no emit', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 50 }), unit: 'kg', maxCapacity: 100 },
    })

    await field(wrapper).setValue('150')

    const hint = wrapper.find('.mass-station-input__reject-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('Maximum is 100 kg')
    expect(weightEmissions(wrapper)).not.toContain(150)
  })

  it('rejects a value below the unusable-fuel floor with a "Minimum is …" hint and no emit', async () => {
    const wrapper = mount(MassStationInput, {
      props: {
        station: makeStation({ weight: 50 }),
        unit: 'L',
        unusableFuel: 5,
        maxCapacity: 100,
      },
    })

    await field(wrapper).setValue('2')

    const hint = wrapper.find('.mass-station-input__reject-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('Minimum is 5 L')
    expect(weightEmissions(wrapper)).not.toContain(2)
  })

  it('clears the rejection hint as soon as a valid value is entered', async () => {
    const wrapper = mount(MassStationInput, {
      props: { station: makeStation({ weight: 0 }) },
    })

    await field(wrapper).setValue('1e2')
    expect(wrapper.find('.mass-station-input__reject-hint').exists()).toBe(true)

    await field(wrapper).setValue('42')
    expect(wrapper.find('.mass-station-input__reject-hint').exists()).toBe(false)
    expect(weightEmissions(wrapper)).toContain(42)
  })

  it('auto-dismisses the transient hint after the timeout', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(MassStationInput, {
        props: { station: makeStation({ weight: 0 }) },
      })

      await field(wrapper).setValue('1e2')
      expect(wrapper.find('.mass-station-input__reject-hint').exists()).toBe(true)

      vi.advanceTimersByTime(3000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.mass-station-input__reject-hint').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
