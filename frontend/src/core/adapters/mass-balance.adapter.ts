import { z } from 'zod'
import type { MathCoreInput, MathCoreResult } from '../domain/mass-balance.math-types'
import { computeMassBalanceCore } from '../logic/mass-balance.logic'
import { mapZodErrorToViolations } from './mb.zod-violation-mapping'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('MassBalance.Adapter')

const createNumReq = () => z.number()
const createNumGt0Req = () => createNumReq().gt(0, { message: 'NEGATIVE_VALUE' })
const createNumMin0Req = () => createNumReq().min(0, { message: 'NEGATIVE_VALUE' })
const createIndexReq = () => createNumMin0Req().max(19, { message: 'OUT_OF_RANGE' })

const ArmLookupEntrySchema = z.object({
  massOrVolume: createNumMin0Req(),
  arm: createNumReq().optional(),
  moment: createNumReq(),
})

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string({ message: 'REQUIRED' }),
  ordinalPosition: createNumReq(),
})

const EnvelopePointSchema = z.object({
  mass: createNumReq(),
  armOrMoment: createNumReq(),
})

// @IMP-AD-CORE-002@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-012@, @DES-ARCH-002@)
export const MathCoreInputSchema = z
  .object({
    stations: z
      .array(
        z.object({
          index: createIndexReq(),
          mass: createNumMin0Req(),
          arm: createNumReq().nullable(),
          armLookup: z.array(ArmLookupEntrySchema).optional().default([]),
        }),
      )
      .max(20, { message: 'TOO_MANY_ITEMS' }),
    basicEmptyMass: createNumGt0Req(),
    emptyCenterOfGravity: createNumReq(),
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
          arm: createNumReq().nullable(),
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
        // Fehler 1: Beide fehlen
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

  try {
    return computeMassBalanceCore(result.data as MathCoreInput)
  } catch (err) {
    logger.error('Core failed', { error: (err as Error).message, input: result.data })
    throw err
  }
}
