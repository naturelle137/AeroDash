import { describe, expect, it } from 'vitest'

// Vite raw imports avoid Node-only APIs so vue-tsc stays green.
const sources = import.meta.glob<string>(
  [
    '../views/PerformanceView.vue',
    './PerformanceStepPanel.vue',
    './PressureAltitudeFieldset.vue',
    './ManualWindComponentPanel.vue',
    '../../fuel-endurance/components/FuelEnduranceCard.vue',
    '../../fuel-endurance/components/ElectricEnergyCard.vue',
  ],
  { query: '?raw', import: 'default', eager: true },
)

// @REQ-UQ-001 Performance and Fuel numeric inputs keep a 44 px minimum hit target.
const MIN_PX = 44

function inputRuleMinHeight(file: string): number {
  const source = sources[file] ?? ''
  expect(source, `${file}: source loaded`).toBeTruthy()
  const style = source.split('<style')[1] ?? ''
  const rules = style.split('}').filter((r: string) => /(^|\n)\s*input[\s,{]/.test(r))
  const match = rules.map((r: string) => /min-height:\s*(\d+)px/.exec(r)).find(Boolean)
  expect(match, `${file}: input rule with min-height`).toBeTruthy()
  return Number(match![1])
}

describe('REQ-UQ-001 touch targets for Performance and Fuel inputs', () => {
  it.each([
    '../views/PerformanceView.vue',
    './PerformanceStepPanel.vue',
    './PressureAltitudeFieldset.vue',
    './ManualWindComponentPanel.vue',
    '../../fuel-endurance/components/FuelEnduranceCard.vue',
    '../../fuel-endurance/components/ElectricEnergyCard.vue',
  ])('%s input min-height is at least 44 px', (file) => {
    expect(inputRuleMinHeight(file)).toBeGreaterThanOrEqual(MIN_PX)
  })
})
