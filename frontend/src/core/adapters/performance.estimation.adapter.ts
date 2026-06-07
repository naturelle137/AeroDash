import { z } from 'zod'
import {
  estimateBaseDistances,
  type EstimationInput,
  type EstimationResult,
} from '../logic/performance.estimation'

// @IMP-PF-CORE-026@ (FROM: @REQ-SYS-011@, @REQ-SYS-012@, @REQ-PF-005@)
// Every distance is `.finite()` and `.gt(0)`: bare `z.number()` accepts ±Infinity
// and 0, which would propagate a non-physical base value (and, via the ratio, a
// non-physical estimate) into the Go/No-Go advisory. The generous SI ceiling
// rejects absurd magnitudes before they reach the math. All values are
// SI-normalised (metres) at the store boundary; each is optional because a gap
// is the very case CAA SSL 07 estimation exists to fill (REQ-PF-005).
const MAX_DISTANCE_M = 100_000
const optionalDistance = () => z.number().finite().gt(0).max(MAX_DISTANCE_M).optional()

export const EstimationInputSchema = z.object({
  takeoffRoll: optionalDistance(),
  takeoffDistance50ft: optionalDistance(),
  landingRoll: optionalDistance(),
  landingDistance50ft: optionalDistance(),
})

// @IMP-PF-CORE-025@ (FROM: @REQ-PF-005@, @REQ-PF-017@, @REQ-SYS-011@)
/**
 * Validate raw input with Zod, then resolve the four base distances (estimating
 * a missing 50 ft distance via CAA SSL 07). On a validation failure it returns a
 * typed `invalid_input` failure — it never throws.
 */
export function applyEstimation(input: unknown): EstimationResult {
  const parsed = EstimationInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'failure',
      reason: 'invalid_input',
      message: 'Estimation input failed schema validation (finite, strictly-positive distances required).',
    }
  }
  return estimateBaseDistances(parsed.data satisfies EstimationInput)
}
