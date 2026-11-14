/**
 * Presentation helper: arithmetic difference between a calculated mass and a
 * stored mass limit. Classification uses the raw values; only the displayed
 * magnitude is rounded, always in the direction that never overstates margin
 * (floor) and never understates excess (ceil, minimum one display unit), judged
 * by the parsed displayed value against the raw difference. No tolerance is used.
 * Not a Go/No-Go or margin assessment.
 */

export type MassLimitRelation = 'below' | 'at' | 'above'

export interface MassLimitDifference {
  relation: MassLimitRelation
  /** Magnitude in kg with one decimal; "<0.1" for a positive margin below one display unit. */
  magnitude: string
}

/** Display resolution in kg (one-decimal convention). */
const UNIT = 0.1

/** Parsed value of a one-decimal display step count (what the pilot actually reads). */
function shown(steps: number): number {
  return Number((steps * UNIT).toFixed(1))
}

/**
 * @returns null when mass or limit is missing, non-finite or the limit is not positive.
 */
export function massLimitDifference(
  mass: number | null | undefined,
  limit: number | null | undefined,
): MassLimitDifference | null {
  if (mass == null || limit == null) return null
  if (!Number.isFinite(mass) || !Number.isFinite(limit) || !(limit > 0)) return null

  const difference = limit - mass
  if (difference === 0) return { relation: 'at', magnitude: (0).toFixed(1) }

  // The estimate from division is corrected against the parsed display value, so
  // the shown figure is compared with the raw delta itself. Where binary floats
  // put the true delta marginally on the unfavourable side of a decimal boundary
  // (e.g. 630 - 629.7 is 0.29999999999995), the more conservative step is shown.
  const magnitude = Math.abs(difference)
  if (difference > 0) {
    let steps = Math.floor(magnitude / UNIT)
    while (steps > 0 && shown(steps) > magnitude) steps--
    return {
      relation: 'below',
      magnitude: steps === 0 ? '<0.1' : (steps * UNIT).toFixed(1),
    }
  }
  let steps = Math.max(1, Math.ceil(magnitude / UNIT))
  while (shown(steps) < magnitude) steps++
  return { relation: 'above', magnitude: (steps * UNIT).toFixed(1) }
}

/** Text with no reliance on colour; `limitName` is e.g. "MTOM". */
export function massLimitDifferenceText(diff: MassLimitDifference, limitName: string): string {
  if (diff.relation === 'at') return `Exactly at ${limitName}`
  const direction = diff.relation === 'below' ? 'Below' : 'Above'
  return diff.magnitude === '<0.1'
    ? `${direction} ${limitName} by less than 0.1 kg`
    : `${direction} ${limitName} by ${diff.magnitude} kg`
}
