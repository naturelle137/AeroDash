/**
 * Canonical Math Test Vector Schema.
 * Validates external JSON vector files before test execution.
 *
 * P1 Safety Core — pure TypeScript + Zod. No framework dependencies.
 */
import { z } from 'zod'

const ArmLookupEntrySchema = z.object({
  massOrVolume: z.number(),
  moment: z.number(),
})

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string(),
  ordinalPosition: z.number().int(),
})

const EnvelopePointSchema = z.object({
  armOrMoment: z.number(),
  mass: z.number(),
})

const StationInputSchema = z.object({
  index: z.number().int().nonnegative(),
  mass: z.number().nonnegative(),
  arm: z.number().nullable(),
  armLookup: z.array(ArmLookupEntrySchema),
})

const FuelStationInputSchema = StationInputSchema.extend({
  unusableFuel: z.number().nonnegative(),
  burnSequences: z.array(BurnSequenceEntrySchema),
})

const CgPointExpectationSchema = z.object({
  arm: z.number(),
  mass: z.number(),
  moment: z.number(),
})

const CanonicalVectorSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]+-\d+$/, 'Vector ID must match pattern e.g. DA40-01'),
  description: z.string().min(1),
  source: z.string().min(1),
  tolerance: z.number().int().min(1).max(10).default(4),
  input: z.object({
    basicEmptyMass: z.number().positive(),
    emptyCenterOfGravity: z.number(),
    maxTakeoffMass: z.number().positive(),
    maxZeroFuelMass: z.number().positive().nullable(),
    graphType: z.enum(['arm', 'moment']),
    envelope: z.array(EnvelopePointSchema).min(3),
    stations: z.array(StationInputSchema),
    fuelStations: z.array(FuelStationInputSchema),
  }),
  expected: z.object({
    zeroFuelCg: CgPointExpectationSchema,
    takeoffCg: CgPointExpectationSchema,
    landingCg: CgPointExpectationSchema,
    violations: z.array(z.string()),
    success: z.boolean(),
  }),
})

export const CanonicalVectorFileSchema = z.object({
  aircraft: z.string().min(1),
  source: z.string().min(1),
  vectors: z.array(CanonicalVectorSchema).min(1),
})

export type CanonicalVector = z.infer<typeof CanonicalVectorSchema>
export type CanonicalVectorFile = z.infer<typeof CanonicalVectorFileSchema>
