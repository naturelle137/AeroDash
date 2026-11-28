import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../MassStationInput.vue'), 'utf8')
const MIN_REM = 44 / 16

function rule(selector: string): string {
  const body = source.split(`\n${selector} {`)[1]?.split('}')[0]
  expect(body).toBeDefined()
  return body!
}

function remValue(body: string, property: string): number {
  const match = body.match(new RegExp(`${property}:\\s*([\\d.]+)rem`))
  expect(match).not.toBeNull()
  return Number(match![1])
}

describe('MassStationInput touch targets', () => {
  it.each([
    ['.mass-station-input__stepper', 'min-width'],
    ['.mass-station-input__stepper', 'min-height'],
    ['.mass-station-input__field', 'min-height'],
    ['.mass-station-input__preset-chip', 'min-height'],
    ['.mass-station-input__slider', 'min-height'],
  ])('%s %s is at least 44 px', (selector, property) => {
    expect(remValue(rule(selector), property)).toBeGreaterThanOrEqual(MIN_REM)
  })
})
