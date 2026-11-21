/** FSM 3/75 fallback; adverse ground-roll adaptations are withheld because the source applies to total distance. */

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
  | { status: 'unsupported'; reason: 'tailwind' | 'surface' | 'adverse-slope' | 'grass'; }

export function estimateFsmTakeoff(input: FsmTakeoffInput): FsmTakeoffResult {
  const { groundRoll, distanceOver50ft, headwindKt, slopePercent } = input
  for (const value of [groundRoll, distanceOver50ft, headwindKt, slopePercent]) {
    if (!Number.isFinite(value)) throw new RangeError('FSM estimate inputs must be finite numbers')
  }
  if (groundRoll < 0 || distanceOver50ft < groundRoll) throw new RangeError('Distances must satisfy 0 <= ground roll <= distance over 50 ft')
  if (headwindKt < 0) return { status: 'unsupported', reason: 'tailwind' }
  if (!['paved:dry', 'unpaved:dry-short-grass'].includes(input.surface)) return { status: 'unsupported', reason: 'surface' }
  if (slopePercent > 0) return { status: 'unsupported', reason: 'adverse-slope' }
  if (input.surface === 'unpaved:dry-short-grass') return { status: 'unsupported', reason: 'grass' }

  const notCredited: FsmNotCredited[] = []
  if (headwindKt > 0) notCredited.push('headwind')
  if (slopePercent < 0) notCredited.push('favourable-slope')
  return { status: 'estimated', groundRoll, distanceOver50ft, notCredited }
}
