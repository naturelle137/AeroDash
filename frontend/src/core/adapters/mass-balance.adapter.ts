import { z } from 'zod'
import type { MathCoreInput, MathCoreResult, Violation } from '../domain/mass-balance.math-types'
import { computeMassBalanceCore } from '../logic/mass-balance.logic'

// Basic schema building blocks
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
          index: createIndexReq(), // Nutzt die neue 0-19 Regel
          mass: createNumMin0Req(),
          arm: createNumReq().nullable(),
          armLookup: z.array(ArmLookupEntrySchema).optional().default([]),
          unusableFuel: createNumMin0Req(),
          burnSequences: z.array(BurnSequenceEntrySchema).optional().default([]),
        }),
      )
      .max(10, { message: 'TOO_MANY_ITEMS' }),
  })
  .superRefine((data, ctx) => {
    // 1. REQ-AD-002: Gesamtanzahl (beide Arrays zusammen) darf 20 nicht überschreiten
    const totalPoints = data.stations.length + data.fuelStations.length
    if (totalPoints > 20) {
      ctx.addIssue({
        code: 'custom',
        message: 'TOO_MANY_ITEMS',
        path: ['stations'],
      })
    }

    // 2. REQ-AD-003: Eindeutige Indizes über BEIDE Arrays hinweg
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
        // Fehler 2: Beide sind da (Kollision!)
        ctx.addIssue({
          code: 'custom',
          message: 'NOT_ALLOWED', // Wirft deinen existierenden Error-Code
          path: [basePath, index, 'arm'],
        })
      }
    }

    data.stations.forEach((s, i) => checkAndAddIndex(s.index, ['stations', i, 'index']))
    data.fuelStations.forEach((fs, i) => checkAndAddIndex(fs.index, ['fuelStations', i, 'index']))
    data.stations.forEach((s, i) => validateArmXor(s, 'stations', i))
    data.fuelStations.forEach((fs, i) => validateArmXor(fs, 'fuelStations', i))
  })

const mapZodErrorToViolations = (error: z.ZodError): Violation[] => {
  return error.issues.map((err) => {
    const pArray = err.path || []
    let fieldPath = pArray
      .map((p) => {
        if (typeof p === 'number') return `[${p}]`
        return p.toString().toUpperCase()
      })
      .join('.')
      .replace(/\.\[/g, '[')

    fieldPath = fieldPath
      .replace(/^BASICEMPTYMASS/, 'BEM')
      .replace(/^MAXTAKEOFFMASS/, 'MTOM')
      .replace(/^MAXZEROFUELMASS/, 'MZFM')
      .replace(/^EMPTYCENTEROFGRAVITY/, 'EMPTY_CG')
      .replace(/^FUELSTATIONS/, 'FUEL_STATIONS')

    // Zod provides the message we set, else fallback
    let code: Violation['code'] = 'REQUIRED'
    if (
      [
        'REQUIRED',
        'NOT_A_NUMBER',
        'NEGATIVE_VALUE',
        'NOT_ALLOWED',
        'OUT_OF_RANGE',
        'TOO_MANY_ITEMS',
        'DUPLICATE_INDEX',
      ].includes(err.message)
    ) {
      code = err.message as Violation['code']
    } else if (err.code === 'invalid_type') {
      const isMissing =
        err.message.includes('received undefined') || err.message.includes('received null')
      code = isMissing ? 'REQUIRED' : 'NOT_A_NUMBER'
    }

    return {
      type: 'INVALID_INPUT',
      severity: 'CRITICAL',
      field: fieldPath,
      code,
    }
  })
}

/**
 * Synchronously calculate mass, CG, and safety violations.
 * Adapter version with Zod schema validation.
 * @param input - Unvalidated raw input
 */
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

  // If valid, delegate pure math to logic layer
  try {
    return computeMassBalanceCore(result.data as MathCoreInput)
  } catch (err) {
    console.error('Core failed with:', (err as Error).message, result.data)
    throw err
  }
}
