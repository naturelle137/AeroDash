/**
 * SI unit normalization for AeroDash.
 *
 * Converts user-facing values from their source unit to the internal SI
 * reference frame (kg, m, L, s) used by all core calculation logic.
 *
 * Pure mathematical functions. P1 Safety Core.
 *
 * @see REQ-SYS-003
 */
import { MASS_UNITS, ARM_UNITS } from '../domain/units'
import type { MassUnit, ArmUnit, VolumeUnit } from '../domain/units'
import { FT_TO_M, IN_TO_M, LB_TO_KG, US_GAL_TO_L } from './unit-conversion-constants'


// ─── sourceUnit parsing (mass + arm/length) ───────────────────────────────────

/**
 * Parse a profile `sourceUnit` string into its mass and arm (length) components.
 *
 * AeroDash stores values at rest in their source unit (REQ-AD-014). The mass
 * unit and the arm/length unit are two independent dimensions, but only a
 * single `sourceUnit` string is carried on the profile. We support:
 *
 *   - mass-only:  `'kg'` | `'lb'`                  → arm defaults to `'m'`
 *   - combined:   `'<mass>-<arm>'` e.g. `'lb-in'`, `'kg-m'`, `'lb-ft'`
 *
 * Existing metric profiles (`sourceUnit: 'kg'`) parse to `{ massUnit: 'kg',
 * armUnit: 'm' }`, preserving today's behaviour EXACTLY — no migration needed.
 * Imperial profiles whose POH arms are in inches declare e.g. `'lb-in'` so the
 * arm and moment are normalized to SI instead of being passed through as if
 * already metric — silent wrong-CG defect.
 *
 * Unknown / malformed components fall back to the SI default for that
 * dimension (`kg` / `m`), which is the fail-safe choice: it never silently
 * scales a value by a wrong factor.
 */
export function parseSourceUnit(sourceUnit: string): { massUnit: MassUnit; armUnit: ArmUnit } {
  const [rawMass, rawArm] = sourceUnit.trim().toLowerCase().split('-')
  const massUnit: MassUnit = (MASS_UNITS as readonly string[]).includes(rawMass ?? '')
    ? (rawMass as MassUnit)
    : 'kg'
  const armUnit: ArmUnit =
    rawArm !== undefined && (ARM_UNITS as readonly string[]).includes(rawArm)
      ? (rawArm as ArmUnit)
      : 'm'
  return { massUnit, armUnit }
}

// ─── Mass normalization (→ kg) ────────────────────────────────────────────────

/**
 * Normalize a mass value from its source unit to kg.
 */
export function normalizeMassToKg(value: number, sourceUnit: MassUnit): number {
  if (sourceUnit === 'lb') return value * LB_TO_KG
  return value // already kg
}

/**
 * Convert kg to the target display unit.
 */
export function massKgToUnit(kg: number, targetUnit: MassUnit): number {
  if (targetUnit === 'lb') return kg / LB_TO_KG
  return kg
}

// ─── Arm normalization (→ m) ──────────────────────────────────────────────────

/**
 * Normalize an arm value from its source unit to metres.
 */
export function normalizeArmToM(value: number, sourceUnit: ArmUnit): number {
  if (sourceUnit === 'in') return value * IN_TO_M
  if (sourceUnit === 'ft') return value * FT_TO_M
  return value // already m
}

/**
 * Convert metres to the target display unit.
 */
export function armMToUnit(m: number, targetUnit: ArmUnit): number {
  if (targetUnit === 'in') return m / IN_TO_M
  if (targetUnit === 'ft') return m / FT_TO_M
  return m
}

// ─── Moment normalization (→ kg·m) ────────────────────────────────────────────

/**
 * Normalize a stored moment to SI (kg·m).
 *
 * Stored moments (`armLookup.moment`, envelope `armOrMoment` in moment-graph
 * mode) are expressed in the profile `sourceUnit`: profile mass unit × arm
 * unit. An `lb-in` profile stores lb·in, `lb-ft` stores lb·ft, `kg-in` kg·in
 * and `kg`/`kg-m` kg·m. Both factors are required; applying only the length
 * factor would label lb·m as kg·m. Station-level unit overrides do not change
 * the moment unit.
 *
 * @param value - moment in (massUnit · armUnit)
 * @param massUnit - the profile mass unit of the moment's mass component
 * @param armUnit - the arm/length unit of the moment's length component
 * @returns moment in kg·m
 */
export function normalizeMomentToSI(value: number, massUnit: MassUnit, armUnit: ArmUnit): number {
  return normalizeArmToM(normalizeMassToKg(value, massUnit), armUnit)
}

// ─── Volume normalization (→ L) ───────────────────────────────────────────────

/**
 * Normalize a volume value from its source unit to litres.
 */
export function normalizeVolumeToL(value: number, sourceUnit: VolumeUnit): number {
  if (sourceUnit === 'gal') return value * US_GAL_TO_L
  return value // already L
}

/**
 * Convert litres to the target display unit.
 */
export function volumeLToUnit(l: number, targetUnit: VolumeUnit): number {
  if (targetUnit === 'gal') return l / US_GAL_TO_L
  return l
}
