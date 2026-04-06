/**
 * Conservative display rounding for AeroDash.
 *
 * Per REQ-UQ-004: mass and required distances round UP (Math.ceil),
 * fuel/endurance values round DOWN (Math.floor).
 *
 * Pure mathematical functions. P1 Safety Core.
 *
 * @see REQ-UQ-004
 */

// @IMP-SYS-CORE-007@ (FROM: @REQ-UQ-004@)

/**
 * Apply conservative upward rounding to a mass or distance value and
 * format it to the specified number of decimal places.
 *
 * The value is scaled to the desired decimal place, rounded up (ceil),
 * then scaled back. This ensures the displayed value is never less than
 * the calculated value (pessimistic / conservative).
 *
 * @param value - Value in SI units.
 * @param decimals - Number of decimal places in the output string.
 * @returns Formatted string with conservative (ceil) rounding.
 */
export function formatMassConservative(value: number, decimals: number = 1): string {
  const factor = Math.pow(10, decimals)
  return (Math.ceil(value * factor) / factor).toFixed(decimals)
}

/**
 * Apply conservative downward rounding to a fuel or endurance value and
 * format it to the specified number of decimal places.
 *
 * The value is scaled to the desired decimal place, rounded down (floor),
 * then scaled back. This ensures the displayed value is never greater than
 * the calculated value (pessimistic / conservative).
 *
 * @param value - Value in SI units.
 * @param decimals - Number of decimal places in the output string.
 * @returns Formatted string with conservative (floor) rounding.
 */
export function formatFuelConservative(value: number, decimals: number = 1): string {
  const factor = Math.pow(10, decimals)
  return (Math.floor(value * factor) / factor).toFixed(decimals)
}

/**
 * Format an arm or moment value (CG position) to the specified decimal
 * places using standard rounding (not conservative).
 *
 * @param value - Arm or moment value.
 * @param decimals - Number of decimal places (default 3 for metres).
 * @returns Formatted string.
 */
export function formatArm(value: number, decimals: number = 3): string {
  return value.toFixed(decimals)
}

// @IMP-SYS-CORE-008@ (FROM: @REQ-UQ-003@)
/**
 * Return the display decimal precision for a given unit symbol.
 *
 * Policy (REQ-UQ-003):
 *   - m   → 3 (physical resolution ~1 mm)
 *   - cm  → 1
 *   - mm  → 0
 *   - in  → 2
 *   - kg, lb, L, gal → 1
 *   - All other units → 1 (safe default)
 */
export function getDecimalPrecision(unit: string): number {
  switch (unit) {
    case 'm':
      return 3
    case 'cm':
      return 1
    case 'mm':
      return 0
    case 'in':
      return 2
    case 'kg':
    case 'lb':
    case 'L':
    case 'gal':
      return 1
    default:
      return 1
  }
}
