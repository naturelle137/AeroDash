import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import { FUEL_DENSITY_KG_PER_L, getFuelDensityKgPerL } from '@/core/logic/fuel-density'
import {
  OCCUPANT_PRESET_MASSES_KG,
  OCCUPANT_PRESET_MASSES_LB,
} from '@/modules/mass-balance/data/occupant-presets'

import { loadRegistry, validateRegistry } from '../lib/registry.mjs'

// This spec is the CI surface for the data-constants gate. It runs
// in `pnpm test:unit` (vitest.config.ts includes `scripts/**/*.spec.ts`), so the
// gate is enforced WITHOUT any GitHub Actions workflow change. It asserts:
//   - the registry is schema-complete, source-cited, and not stale, AND
//   - each registry value still matches the real code constant (drift).
// File lives at frontend/scripts/data-constants/__tests__/… → repo root is 4 up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

interface RegistryEntry {
  id: string
  value: unknown
  source: string
  effectiveDate: string
  reviewBy: string
  requirement: string
}

interface Registry {
  constants: RegistryEntry[]
}

let registry: Registry

beforeAll(async () => {
  registry = (await loadRegistry(REPO_ROOT)) as Registry
})

const entry = (id: string): RegistryEntry => {
  const found = registry.constants.find((c) => c.id === id)
  if (!found) throw new Error(`registry entry not found: ${id}`)
  return found
}

describe('data-constants registry gate', () => {
  it('is schema-complete, source-cited, and current (no stale entries)', () => {
    const report = validateRegistry(registry, new Date())
    expect(report.schemaErrors, 'schema errors').toEqual([])
    expect(report.uncited, 'entries with empty/missing source').toEqual([])
    expect(report.stale, 'entries whose reviewBy date has passed').toEqual([])
    expect(report.ok).toBe(true)
  })

  it('contains the expected safety-relevant constants', () => {
    expect(registry.constants.length).toBeGreaterThanOrEqual(5)
  })
})

describe('data-constants drift — registry value matches code', () => {
  // Every registry id MUST appear here so a newly-added constant cannot ship
  // without a drift assertion (see "every constant is drift-checked" below).
  const DRIFT_CHECKED_IDS = new Set<string>([
    'fuel-density-avgas-mogas',
    'fuel-density-jet-diesel',
    'fuel-density-fallback',
    'occupant-preset-masses-kg',
    'occupant-preset-masses-lb',
  ])

  it('fuel-density-avgas-mogas matches FUEL_DENSITY_KG_PER_L (AvGas/MoGas)', () => {
    const v = entry('fuel-density-avgas-mogas').value
    expect(FUEL_DENSITY_KG_PER_L['AvGas 100LL']).toBe(v)
    expect(FUEL_DENSITY_KG_PER_L['AvGas UL91']).toBe(v)
    expect(FUEL_DENSITY_KG_PER_L['MoGas']).toBe(v)
  })

  it('fuel-density-jet-diesel matches FUEL_DENSITY_KG_PER_L (Jet A-1/Diesel)', () => {
    const v = entry('fuel-density-jet-diesel').value
    expect(FUEL_DENSITY_KG_PER_L['Jet A-1']).toBe(v)
    expect(FUEL_DENSITY_KG_PER_L['Diesel']).toBe(v)
  })

  it('fuel-density-fallback matches the conservative unknown-type fallback', () => {
    expect(getFuelDensityKgPerL('__unrecognised-fuel-type__')).toBe(
      entry('fuel-density-fallback').value,
    )
  })

  it('occupant-preset-masses-kg matches OCCUPANT_PRESET_MASSES_KG', () => {
    expect(OCCUPANT_PRESET_MASSES_KG).toEqual(entry('occupant-preset-masses-kg').value)
  })

  it('occupant-preset-masses-lb matches OCCUPANT_PRESET_MASSES_LB', () => {
    expect(OCCUPANT_PRESET_MASSES_LB).toEqual(entry('occupant-preset-masses-lb').value)
  })

  it('every registry constant is drift-checked', () => {
    const unchecked = registry.constants.map((c) => c.id).filter((id) => !DRIFT_CHECKED_IDS.has(id))
    expect(unchecked, 'registry ids without a drift assertion above').toEqual([])
  })
})
