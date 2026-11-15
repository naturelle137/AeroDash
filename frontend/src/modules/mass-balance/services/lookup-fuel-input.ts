import type { LoadPointDefinition } from '@/modules/mass-balance/stores/mass-balance.types'
import type { Violation } from '@/core/domain/mass-balance.math-types'
import { isFuelQuantityUnit } from '@/core/logic/fuel-mass'
import { isKnownFuelType } from '@/core/logic/fuel-density'

// The shared parser tolerates legacy unknown units; tank geometry must not guess them.
export function isExplicitSourceUnit(sourceUnit: string): boolean {
  return /^(kg|lb)(-(m|in|ft))?$/.test(sourceUnit.trim().toLowerCase())
}

/**
 * Raw checks for a variable-geometry fuel tank, run before SI normalization can
 * clamp negatives or substitute a fallback unit/density. Returns a validation code
 * and pilot-facing reason, or null when the raw input may be normalized for the
 * strict P1 check.
 */
export function lookupFuelInputReason(
  def: LoadPointDefinition,
  quantity: number,
  sourceUnit: string,
): { code: string; reason: string } | null {
  const fuel = def.fuelTank
  if (!fuel || def.armLookup.length === 0 || def.arm !== null) return null
  if (!isExplicitSourceUnit(sourceUnit))
    return {
      code: 'UNSUPPORTED_UNIT',
      reason: 'A supported explicit source unit is required for the fuel moment table.',
    }
  if (
    !isFuelQuantityUnit(def.unit) ||
    fuel.permissibleFuelTypes.length === 0 ||
    !fuel.permissibleFuelTypes.every(isKnownFuelType)
  )
    return {
      code: 'UNSUPPORTED_UNIT',
      reason:
        'An explicit supported tank unit and fuel type are required; fallback density is not used.',
    }
  if (
    !def.armLookup.every(
      (e) => Number.isFinite(e.massOrVolume) && e.massOrVolume >= 0 && Number.isFinite(e.moment),
    )
  )
    return { code: 'INVALID_GEOMETRY', reason: LOOKUP_FUEL_MESSAGES.INVALID_GEOMETRY }
  if (!Number.isFinite(fuel.unusableFuel) || fuel.unusableFuel < 0 || !Number.isFinite(quantity))
    return {
      code: 'NOT_A_NUMBER',
      reason: 'Tank load and unusable fuel must be finite and nonnegative.',
    }
  if (quantity < fuel.unusableFuel)
    return { code: 'BELOW_UNUSABLE', reason: LOOKUP_FUEL_MESSAGES.BELOW_UNUSABLE }
  return null
}

type LookupFuelCode =
  'BELOW_UNUSABLE' | 'INVALID_GEOMETRY' | 'LOOKUP_OUT_OF_RANGE' | 'NUMERIC_OVERFLOW'

export const LOOKUP_FUEL_MESSAGES: Record<LookupFuelCode, string> = {
  BELOW_UNUSABLE:
    'Tank load is below unusable fuel; enter the total tank quantity including unusable fuel.',
  INVALID_GEOMETRY:
    'Fuel moment table needs at least two finite points with unique, strictly ascending nonnegative quantities.',
  LOOKUP_OUT_OF_RANGE:
    'Fuel moment table must cover both unusable fuel and the current tank load; values are not clamped or extrapolated.',
  NUMERIC_OVERFLOW: 'Fuel moment calculation exceeds numeric limits.',
}

export function lookupFuelViolationMessage(v: Violation): string | null {
  return v.code && v.code in LOOKUP_FUEL_MESSAGES
    ? LOOKUP_FUEL_MESSAGES[v.code as LookupFuelCode]
    : null
}
