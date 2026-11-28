import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// @REQ-UQ-001 Performance and Fuel numeric inputs keep a 44 px minimum hit target.
const MIN_PX = 44

function inputRuleMinHeight(file: string): number {
  const source = readFileSync(resolve(__dirname, file), 'utf8')
  const style = source.split('<style')[1] ?? ''
  const rules = style.split('}').filter((r) => /(^|\n)\s*input[\s,{]/.test(r))
  const match = rules.map((r) => /min-height:\s*(\d+)px/.exec(r)).find(Boolean)
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
