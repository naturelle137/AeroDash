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
import type { MassUnit, ArmUnit, VolumeUnit } from '../domain/units'

// @IMP-SYS-CORE-006@ (FROM: @REQ-SYS-003@)

// ─── Mass normalization (→ kg) ────────────────────────────────────────────────

const LB_TO_KG = 0.45359237 as const

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

const IN_TO_M = 0.0254 as const
const FT_TO_M = 0.3048 as const

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

// ─── Volume normalization (→ L) ───────────────────────────────────────────────

const GAL_US_TO_L = 3.785411784 as const

/**
 * Normalize a volume value from its source unit to litres.
 */
export function normalizeVolumeToL(value: number, sourceUnit: VolumeUnit): number {
  if (sourceUnit === 'gal') return value * GAL_US_TO_L
  return value // already L
}

/**
 * Convert litres to the target display unit.
 */
export function volumeLToUnit(l: number, targetUnit: VolumeUnit): number {
  if (targetUnit === 'gal') return l / GAL_US_TO_L
  return l
}
