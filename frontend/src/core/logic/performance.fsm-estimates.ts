/**
 * LBA FSM 3/75 take-off estimate, used only when no aircraft manual supplies the corrections.
 * P1 Safety Core: pure TypeScript.
 *
 * The source states percentages for the whole distance to 15 m; AeroDash adapts them as follows, always
 * towards longer distances, and never claims the source validates this reading:
 * - Slope (+10 % per +1 % uphill) and the dry-short-grass surcharge (+20 %) are applied to the ground roll
 *   only, slope first, then the surface, as chained multipliers. The airborne part is unchanged.
 * - The source's dry-paved baseline is not credited: dry paved adds nothing, so a POH table already
 *   flown on grass is never reduced.
 * - Downhill slope and headwind are not credited. The source gives no take-off headwind credit and no
 *   slope range; a tailwind has no value in the source and cannot be estimated.
 * - No 15 m to 50 ft conversion is made; other surface conditions have no unambiguous source row.
 *
 * @see docs/architecture/performance-correction-sources.md
 */

export const FSM_SLOPE_PCT_PER_PCT = 10
export const FSM_SURFACE_SURCHARGE_PCT = { 'paved:dry': 0, 'unpaved:dry-short-grass': 20 } as const

export type FsmTakeoffInput = {
  groundRoll: number
  distanceOver50ft: number
  /** `type:condition` of the declared runway surface, e.g. `unpaved:dry-short-grass`. */
  surface: string
  /** Positive headwind, negative tailwind, knots. */
  headwindKt: number
  /** Positive uphill, percent. */
  slopePercent: number
}

export type FsmNotCredited = 'headwind' | 'favourable-slope'

export type FsmTakeoffResult =
  | { status: 'estimated'; groundRoll: number; distanceOver50ft: number; notCredited: FsmNotCredited[] }
  | { status: 'unsupported'; reason: 'tailwind' | 'surface'; }

export function estimateFsmTakeoff(input: FsmTakeoffInput): FsmTakeoffResult {
  const { groundRoll, distanceOver50ft, headwindKt, slopePercent } = input
  for (const value of [groundRoll, distanceOver50ft, headwindKt, slopePercent]) {
    if (!Number.isFinite(value)) throw new RangeError('FSM estimate inputs must be finite numbers')
  }
  if (groundRoll < 0 || distanceOver50ft < groundRoll) throw new RangeError('Distances must satisfy 0 <= ground roll <= distance over 50 ft')
  if (headwindKt < 0) return { status: 'unsupported', reason: 'tailwind' }
  const surcharge = (FSM_SURFACE_SURCHARGE_PCT as Record<string, number | undefined>)[input.surface]
  if (surcharge === undefined) return { status: 'unsupported', reason: 'surface' }

  const notCredited: FsmNotCredited[] = []
  if (headwindKt > 0) notCredited.push('headwind')
  if (slopePercent < 0) notCredited.push('favourable-slope')
  const slopeFactor = 1 + (Math.max(slopePercent, 0) * FSM_SLOPE_PCT_PER_PCT) / 100
  const roll = groundRoll * slopeFactor * (1 + surcharge / 100)
  return { status: 'estimated', groundRoll: roll, distanceOver50ft: roll + (distanceOver50ft - groundRoll), notCredited }
}
