/**
 * Tecnam P2008 JC Supplement S9 (MTV-34 propeller, 650 kg) environmental corrections.
 * P1 Safety Core: pure TypeScript.
 *
 * Source: AFM Doc. 2008/100 Ed. 2 Rev. 18, pages MT5-7 to MT5-9 (take-off) and MT5-14 (landing).
 * Base distances are for a grass runway. The page states the rules once for both distance rows:
 * additive wind metres per knot, paved -10% on ground roll, slope percent on ground roll per percent.
 *
 * AeroDash interpretation (conservative, source gives no range or order):
 * - Wind and slope adjust the ground roll; the airborne part (distance over 50 ft minus roll) is
 *   unchanged; the wind metres are added to both rows.
 * - Only adverse corrections are applied: tailwind, uphill take-off slope, downhill landing slope.
 *   Headwind and favourable slope credits are reported as not credited, never silently dropped.
 * - Paved credit applies to dry paved runways only; other conditions are unsupported by the caller.
 * - Corrections are applied to the table distance before the source in-service factor.
 *
 * @see docs/architecture/performance-correction-sources.md
 */

export type S9Operation = 'takeoff' | 'landing'

/** AFM rules per operation. Wind in m per kt, slope in % of ground roll per +1 % uphill. */
export const TECNAM_S9_RULES = {
  takeoff: { headwindMPerKt: -5, tailwindMPerKt: 15, pavedRollFactor: 0.9, slopeRollPctPerPct: 7, inServiceFactor: 1.1 },
  landing: { headwindMPerKt: -4, tailwindMPerKt: 13, pavedRollFactor: 0.9, slopeRollPctPerPct: -3, inServiceFactor: 1.67 },
} as const satisfies Record<S9Operation, object>

export type S9CorrectionInput = {
  operation: S9Operation
  /** Uncorrected grass table distances in metres. */
  groundRoll: number
  distanceOver50ft: number
  surface: 'grass' | 'paved'
  /** Positive headwind, negative tailwind, knots. */
  headwindKt: number
  /** Positive uphill, percent. */
  slopePercent: number
}

export type S9NotCredited = 'headwind' | 'favourable-slope'

export type S9CorrectionResult = {
  groundRoll: number
  distanceOver50ft: number
  /** Source in-service factor to apply to both corrected distances. */
  inServiceFactor: number
  factoredGroundRoll: number
  factoredDistanceOver50ft: number
  notCredited: S9NotCredited[]
}

export function applyTecnamS9Corrections(input: S9CorrectionInput): S9CorrectionResult {
  const { groundRoll, distanceOver50ft, headwindKt, slopePercent } = input
  for (const value of [groundRoll, distanceOver50ft, headwindKt, slopePercent]) {
    if (!Number.isFinite(value)) throw new RangeError('S9 correction inputs must be finite numbers')
  }
  if (groundRoll < 0 || distanceOver50ft < groundRoll) throw new RangeError('Distances must satisfy 0 <= ground roll <= distance over 50 ft')
  const rule = TECNAM_S9_RULES[input.operation]
  const notCredited: S9NotCredited[] = []

  let roll = groundRoll
  if (input.surface === 'paved') roll *= rule.pavedRollFactor

  // Slope percent acts on the ground roll; adverse direction only.
  const adverseSlope = input.operation === 'takeoff' ? slopePercent > 0 : slopePercent < 0
  if (slopePercent !== 0 && !adverseSlope) notCredited.push('favourable-slope')
  if (adverseSlope) roll *= 1 + (Math.abs(slopePercent) * Math.abs(rule.slopeRollPctPerPct)) / 100

  const airborne = distanceOver50ft - groundRoll
  let windM = 0
  if (headwindKt < 0) windM = -headwindKt * rule.tailwindMPerKt
  else if (headwindKt > 0) notCredited.push('headwind')

  const correctedRoll = roll + windM
  const correctedDistance = correctedRoll + airborne
  const f = rule.inServiceFactor
  return {
    groundRoll: correctedRoll,
    distanceOver50ft: correctedDistance,
    inServiceFactor: f,
    factoredGroundRoll: correctedRoll * f,
    factoredDistanceOver50ft: correctedDistance * f,
    notCredited,
  }
}
