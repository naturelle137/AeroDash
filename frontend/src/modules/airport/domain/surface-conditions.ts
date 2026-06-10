/**
 * Predefined surface-condition catalogue, keyed by base surface type (REQ-AP-004).
 * P2 Feature Module — pure functions, no framework or P1 imports.
 *
 * Context-aware lists prevent impossible combinations (e.g. "Long Grass" on
 * asphalt): a defect that offered the wrong friction class would feed an
 * incorrect distance downstream (H-009), so the lists are fixed here, not
 * free-text.
 */

import type { BaseSurfaceType, SurfaceConditionOption } from './airport.types'

const PAVED_CONDITIONS: readonly SurfaceConditionOption[] = [
  { id: 'paved-dry', label: 'Dry' },
  { id: 'paved-wet', label: 'Wet' },
  { id: 'paved-standing-water', label: 'Standing Water' },
  { id: 'paved-slush', label: 'Slush' },
  { id: 'paved-snow', label: 'Snow' },
  { id: 'paved-ice', label: 'Ice' },
]

const GRASS_CONDITIONS: readonly SurfaceConditionOption[] = [
  { id: 'grass-dry', label: 'Dry (short grass ≤ 3 cm)' },
  { id: 'grass-long', label: 'Long Grass (> 3 cm to 8 cm)' },
  { id: 'grass-wet-soft', label: 'Wet / Soft Ground' },
  { id: 'grass-damaged-turf', label: 'Damaged Turf' },
  { id: 'grass-snow-ice', label: 'Snow / Ice' },
]

const CATALOGUE: Readonly<Record<BaseSurfaceType, readonly SurfaceConditionOption[]>> = {
  paved: PAVED_CONDITIONS,
  grass: GRASS_CONDITIONS,
}

/** The surface-condition options valid for a given base surface type (REQ-AP-004). */
// @IMP-AP-STORE-001@ (FROM: @REQ-AP-004@)
export function surfaceConditionsFor(base: BaseSurfaceType): readonly SurfaceConditionOption[] {
  return CATALOGUE[base]
}

/** True when `id` is a known condition for `base` — rejects cross-surface mismatches. */
export function isValidSurfaceCondition(base: BaseSurfaceType, id: string | null): boolean {
  if (id === null) return false
  return CATALOGUE[base].some((option) => option.id === id)
}

/** Pilot-facing label for a selected condition, or `null` when it is not valid for `base`. */
export function surfaceConditionLabel(base: BaseSurfaceType, id: string | null): string | null {
  if (id === null) return null
  return CATALOGUE[base].find((option) => option.id === id)?.label ?? null
}
