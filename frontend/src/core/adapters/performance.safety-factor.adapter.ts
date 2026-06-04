import { z } from 'zod'
import type { SafetyFactorResult } from '../domain/performance.math-types'
import {
  computeSafetyFactorPipeline,
  invalidInputViolation,
  OSF_MAX,
  OSF_MIN,
} from '../logic/performance.safety-factor'

// @IMP-PF-CORE-013@ (FROM: @REQ-SYS-011@, @REQ-SYS-012@, @REQ-PF-006@)
// Every numeric field is `.finite()`: bare `z.number()` accepts ±Infinity,
// which would propagate (e.g. `fullRequired = Infinity`) and silently corrupt
// the Go/No-Go advisory. `.finite()` rejects ±Infinity and NaN; the explicit
// generous SI ceilings reject absurd magnitudes before they reach the math.
// All values are SI-normalised (metres) at the store boundary.
const MAX_DISTANCE_M = 100_000
const MAX_FACTOR = 100

const distance = () => z.number().finite().min(0).max(MAX_DISTANCE_M)
/** Base POH distances must be strictly positive — a zero POH distance has no physical meaning. */
const baseDistance = () => z.number().finite().gt(0).max(MAX_DISTANCE_M)
/** Correction multipliers must be strictly positive — a 0/negative factor is optimistic-unsafe. */
const factor = () => z.number().finite().gt(0).max(MAX_FACTOR)

const OsfInputSchema = z
  .object({
    preset: z.enum(['easa-standard', 'poh-afm', 'short-field', 'custom']),
    customMultiplier: z.number().finite().min(OSF_MIN).max(OSF_MAX).optional(),
    pohMandatedFactor: z
      .object({
        takeoff: z.number().finite().min(OSF_MIN).max(MAX_FACTOR).optional(),
        landing: z.number().finite().min(OSF_MIN).max(MAX_FACTOR).optional(),
      })
      .optional(),
  })
  .superRefine((osf, ctx) => {
    if (osf.preset === 'custom' && osf.customMultiplier === undefined) {
      ctx.addIssue({ code: 'custom', message: 'REQUIRED', path: ['customMultiplier'] })
    }
  })

export const SafetyFactorInputSchema = z.object({
  base: z.object({
    takeoffRoll: baseDistance(),
    takeoffDistance50ft: baseDistance(),
    landingRoll: baseDistance(),
    landingDistance50ft: baseDistance(),
  }),
  factors: z.object({
    friction: factor(),
    slope: factor(),
    densityAltitude: factor(),
    wind: factor(),
  }),
  osf: OsfInputSchema,
  available: z.object({
    takeoff: distance(),
    landing: distance(),
  }),
})

// @IMP-PF-CORE-014@ (FROM: @REQ-PF-004@, @REQ-PF-006@, @REQ-PF-007@, @REQ-PF-015@, @REQ-PF-016@, @REQ-SYS-011@)
/**
 * Validate raw input with Zod, then run the safety-factor pipeline. On a
 * validation failure it returns a typed `failure` carrying a single
 * INVALID_INPUT violation (ERR-SYS-001) — it never throws.
 */
export function applySafetyFactors(input: unknown): SafetyFactorResult {
  const parsed = SafetyFactorInputSchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'failure', violations: [invalidInputViolation()] }
  }
  return computeSafetyFactorPipeline(parsed.data)
}
