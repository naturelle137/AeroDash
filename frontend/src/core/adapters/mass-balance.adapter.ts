import { z } from 'zod'
import type { MathCoreInput, MathCoreResult } from '../domain/mass-balance.math-types'
import { computeMassBalanceCore } from '../logic/mass-balance.logic'
import { mapZodErrorToViolations } from './mb.zod-violation-mapping'
// @IMP-MB-CORE-016@ (FROM: @REQ-MB-002@, @REQ-SYS-003@, @REQ-SYS-012@)
// Every numeric field feeding the math core is `.finite()`: Zod's
// `z.number()` (and `.positive()`/`.nonnegative()`) accept ±Infinity, which
// would propagate to `zeroFuelMoment = Infinity` → CG = NaN with
// `success: true` (TECH-003 / CS-002). `.finite()` rejects ±Infinity as
// NOT_A_NUMBER, and explicit SI domain bounds reject absurd magnitudes
// (1e30 / 1e308) as OUT_OF_RANGE before they can corrupt a Go/No-Go advisory.
//
// All values reaching this adapter are already normalized to SI (kg, m, kg·m)
// at the store boundary, so bounds below are in SI units.
//
// Generous-but-physical SI ceilings:
//   mass        ≤ 200_000 kg  (well above any Part-NCO SEP; covers misuse)
//   arm         ∈ [-100, 100] m
//   moment      ∈ [-20_000_000, 20_000_000] kg·m
const MAX_MASS_KG = 200_000
const MAX_ARM_M = 100
const MAX_MOMENT_KGM = 20_000_000

const createNumReq = () => z.number().finite({ message: 'NOT_A_NUMBER' })
const createNumGt0Req = () =>
  createNumReq().gt(0, { message: 'NEGATIVE_VALUE' }).max(MAX_MASS_KG, { message: 'OUT_OF_RANGE' })
const createNumMin0Req = () =>
  createNumReq().min(0, { message: 'NEGATIVE_VALUE' }).max(MAX_MASS_KG, { message: 'OUT_OF_RANGE' })
const createIndexReq = () =>
  createNumReq().min(0, { message: 'NEGATIVE_VALUE' }).max(19, { message: 'OUT_OF_RANGE' })
/** Arm (length, m) — finite, bounded, may be negative (datum behind station). */
const createArmReq = () =>
  createNumReq()
    .min(-MAX_ARM_M, { message: 'OUT_OF_RANGE' })
    .max(MAX_ARM_M, { message: 'OUT_OF_RANGE' })
/** Moment (kg·m) — finite, bounded, may be negative. */
const createMomentReq = () =>
  createNumReq()
    .min(-MAX_MOMENT_KGM, { message: 'OUT_OF_RANGE' })
    .max(MAX_MOMENT_KGM, { message: 'OUT_OF_RANGE' })

const ArmLookupEntrySchema = z.object({
  massOrVolume: createNumMin0Req(),
  arm: createArmReq().optional(),
  moment: createMomentReq(),
})

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string({ message: 'REQUIRED' }),
  ordinalPosition: createNumReq(),
})

const EnvelopePointSchema = z.object({
  mass: createNumMin0Req(),
  // armOrMoment is an arm (m) in arm-graph mode or a moment (kg·m) in
  // moment-graph mode; the moment bound is the wider of the two, so use it.
  armOrMoment: createMomentReq(),
})

// @IMP-AD-CORE-002@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-012@, @DES-ARCH-002@)
export const MathCoreInputSchema = z
  .object({
    stations: z
      .array(
        z.object({
          index: createIndexReq(),
          mass: createNumMin0Req(),
          arm: createArmReq().nullable(),
          armLookup: z.array(ArmLookupEntrySchema).optional().default([]),
        }),
      )
      .max(20, { message: 'TOO_MANY_ITEMS' }),
    basicEmptyMass: createNumGt0Req(),
    emptyCenterOfGravity: createArmReq(),
    maxTakeoffMass: createNumGt0Req(),
    maxZeroFuelMass: createNumGt0Req().nullable(),
    envelope: z.array(EnvelopePointSchema),
    graphType: z.enum(['arm', 'moment'], {
      error: (issue) => {
        const isMissing = issue.input === undefined || issue.input === null
        return isMissing ? 'REQUIRED' : 'NOT_ALLOWED'
      },
    }),
    fuelStations: z
      .array(
        z.object({
          index: createIndexReq(),
          mass: createNumMin0Req(),
          arm: createArmReq().nullable(),
          armLookup: z.array(ArmLookupEntrySchema).optional().default([]),
          unusableFuel: createNumMin0Req(),
          burnSequences: z.array(BurnSequenceEntrySchema).optional().default([]),
        }),
      )
      .max(10, { message: 'TOO_MANY_ITEMS' }),
  })
  // @IMP-AD-CORE-003@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-012@)
  .superRefine((data, ctx) => {
    const totalPoints = data.stations.length + data.fuelStations.length
    if (totalPoints > 20) {
      ctx.addIssue({
        code: 'custom',
        message: 'TOO_MANY_ITEMS',
        path: ['stations'],
      })
    }

    const seenIndices = new Set<number>()

    const checkAndAddIndex = (index: number, path: (string | number)[]) => {
      if (seenIndices.has(index)) {
        ctx.addIssue({
          code: 'custom',
          message: 'DUPLICATE_INDEX',
          path,
        })
      } else {
        seenIndices.add(index)
      }
    }

    const validateArmXor = (
      item: { arm: number | null; armLookup: unknown[] },
      basePath: string,
      index: number,
    ) => {
      const hasArm = item.arm !== null
      const hasLookup = item.armLookup.length > 0

      if (!hasArm && !hasLookup) {
        ctx.addIssue({
          code: 'custom',
          message: 'REQUIRED',
          path: [basePath, index, 'arm'],
        })
      } else if (hasArm && hasLookup) {
        ctx.addIssue({
          code: 'custom',
          message: 'NOT_ALLOWED',
          path: [basePath, index, 'arm'],
        })
      }
    }

    data.stations.forEach((s, i) => checkAndAddIndex(s.index, ['stations', i, 'index']))
    data.fuelStations.forEach((fs, i) => checkAndAddIndex(fs.index, ['fuelStations', i, 'index']))
    data.stations.forEach((s, i) => validateArmXor(s, 'stations', i))
    data.fuelStations.forEach((fs, i) => validateArmXor(fs, 'fuelStations', i))
  })

/**
 * Synchronously calculate mass, CG, and safety violations.
 * Adapter version with Zod schema validation.
 * @param input - Unvalidated raw input
 */
// @IMP-MB-CORE-014@ (FROM: @REQ-MB-002@, @DES-ARCH-005@)
export function calculateMassBalance(input: unknown): MathCoreResult {
  const result = MathCoreInputSchema.safeParse(input)

  if (!result.success) {
    const violations = mapZodErrorToViolations(result.error)
    return {
      success: false,
      violations,
      zeroFuelCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
      takeoffCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
      landingCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
      migrationPath: [],
    }
  }

  return computeMassBalanceCore(result.data as MathCoreInput)
}
