import { z } from 'zod'

/**
 * Canonical Zod schemas for the AircraftProfile aggregate-root document.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * M2 (Basic M&B): All fields in this file except the M3/M4 placeholder
 * fields are strictly validated. Performance, Checklists, and Operating
 * Cost are typed as unknown until their milestone specs are finalized.
 *
 * @see docs/architecture/aircraft_data_model.md
 * @see docs/architecture/adr/003-aircraft-data-model.md
 */

const ArmLookupEntrySchema = z.object({
  massOrVolume: z.number(),
  moment: z.number(),
})

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string().min(1),
  ordinalPosition: z.number().int().positive(),
})

const FuelTankExtensionSchema = z.object({
  unusableFuel: z.number().nonnegative(),
  permissibleFuelTypes: z
    .array(z.enum(['MoGas', 'AvGas 100LL', 'Jet A-1', 'AvGas UL91', 'Diesel']))
    .min(1),
  burnSequences: z.array(BurnSequenceEntrySchema),
})

const LoadPointSchema = z.object({
  name: z.string().min(1),
  arm: z.number().nullable(),
  armLookup: z.array(ArmLookupEntrySchema).default([]),
  operationalLimit: z.number().nonnegative().nullable(),
  defaultQuantity: z.number().nonnegative(),
  unit: z.string().min(1),
  allowableCategories: z.array(z.enum(['Normal', 'Utility', 'Aerobatic'])).nullable(),
  fuelTank: FuelTankExtensionSchema.nullable(),
})

const EnvelopePointSchema = z.object({
  armOrMoment: z.number(),
  mass: z.number(),
})

const CertificationCategorySchema = z.object({
  category: z.enum(['Normal', 'Utility', 'Aerobatic']),
  mtom: z.number().positive(),
  maxZeroFuelMass: z.number().positive().nullable(),
  graphType: z.enum(['arm', 'moment']),
  envelope: z.array(EnvelopePointSchema).min(4).max(20),
})

// @IMP-AD-CORE-005@ (FROM: @REQ-AD-004@)
const WeighingReportSchema = z.object({
  bem: z.number().positive(),
  emptyCg: z.number(),
  weighingDate: z.string().min(1),
  validFrom: z.string().min(1),
})

const WindLimitSchema = z.object({
  component: z.enum(['MaxCrosswind', 'MaxTailwind', 'MaxTotalWind', 'MaxGust']),
  value: z.number().nonnegative(),
  classification: z.enum(['Demonstrated', 'Limit']),
})

const SurfaceConditionSchema = z.object({
  name: z.string().min(1),
  takeoffFactor: z.number().positive(),
  landingFactor: z.number().positive(),
})

const SafetyFactorsSchema = z.object({
  takeoff: z.number().positive(),
  landing: z.number().positive(),
})

// @IMP-AD-CORE-004@ (FROM: @REQ-AD-001@, @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@, @REQ-AD-014@, @DES-ARCH-002@)
export const AircraftProfileSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().min(1),
    registration: z.string().min(1),
    manufacturer: z.string().min(1),
    model: z.string().min(1),
    icaoTypeDesignator: z.string().min(1),
    sourceUnit: z.string().min(1),
    referenceDatumDescription: z.string().min(1),
    referenceDatumLocation: z.string().min(1),
    shareCode: z.string().nullable(),
    weighingReports: z.array(WeighingReportSchema).min(1),
    loadPoints: z.array(LoadPointSchema).max(20),
    certificationCategories: z.array(CertificationCategorySchema).min(1),
    windLimits: z.array(WindLimitSchema).optional(),
    surfaceConditions: z.array(SurfaceConditionSchema).optional(),
    safetyFactors: SafetyFactorsSchema.optional(),
    // M3/M4 placeholder fields — typed as unknown until milestone specs are finalized
    performanceProfiles: z.array(z.unknown()).optional(),
    checklists: z.array(z.unknown()).optional(),
    operatingCost: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    const fuelTankCount = data.loadPoints.filter((lp) => lp.fuelTank !== null).length
    if (fuelTankCount > 10) {
      ctx.addIssue({
        code: 'custom',
        message: 'TOO_MANY_FUEL_TANKS',
        path: ['loadPoints'],
      })
    }

    data.loadPoints.forEach((lp, i) => {
      const hasArm = lp.arm !== null
      const hasLookup = lp.armLookup.length > 0

      if (!hasArm && !hasLookup) {
        ctx.addIssue({
          code: 'custom',
          message: 'REQUIRED',
          path: ['loadPoints', i, 'arm'],
        })
      } else if (hasArm && hasLookup) {
        ctx.addIssue({
          code: 'custom',
          message: 'NOT_ALLOWED',
          path: ['loadPoints', i, 'arm'],
        })
      }
    })
  })

export type AircraftProfile = z.infer<typeof AircraftProfileSchema>
export type AircraftProfileLoadPoint = z.infer<typeof LoadPointSchema>
export type AircraftProfileFuelTankExtension = z.infer<typeof FuelTankExtensionSchema>
export type AircraftProfileCertificationCategory = z.infer<typeof CertificationCategorySchema>
export type AircraftProfileWeighingReport = z.infer<typeof WeighingReportSchema>
export type AircraftProfileWindLimit = z.infer<typeof WindLimitSchema>
export type AircraftProfileSurfaceCondition = z.infer<typeof SurfaceConditionSchema>
export type AircraftProfileSafetyFactors = z.infer<typeof SafetyFactorsSchema>
