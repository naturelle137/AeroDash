/**
 * Zod schema for the AircraftContext runtime subset.
 *
 * Validates catalogue / IndexedDB data before it reaches the Pinia store.
 * Distinct from AircraftProfileSchema which validates the full persisted document
 * (different field names: basicEmptyMass vs bem, maxTakeoffMass vs mtom, etc.).
 *
 * @see AircraftContext in core/domain/aircraft.types.ts
 */
import { z } from 'zod'
import { CANONICAL_FUEL_TYPES } from '@/core/logic/fuel-density'

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string(),
  ordinalPosition: z.number(),
})

// @IMP-MB-DATA-003@ (FROM: @REQ-FE-001@, @REQ-SYS-003@, H-002)
// Converge the runtime context onto the fuel-type enum: a
// loose `z.array(z.string())` let arbitrary strings reach fuel-density, where a
// typo / attacker value silently resolved to the 0.84 fallback and miscomputed
// AvGas vs Jet-A mass. We accept the canonical keys PLUS the two deprecated
// uppercase aliases (`AVGAS`, `MOGAS`) that still resolve a CORRECT (non-
// fallback) density — these are tolerated here so in-flight runtime data mid-
// migration is not rejected. The authoritative fleet/exchange document schema
// (AircraftProfileSchema) remains canonical-only, so newly written profiles can
// never persist a legacy alias. `.min(1)` keeps the "at least one permissible
// fuel" invariant.
const ACCEPTED_FUEL_TYPES = [...CANONICAL_FUEL_TYPES, 'AVGAS', 'MOGAS'] as const

const FuelTankSchema = z.object({
  unusableFuel: z.number().nonnegative(),
  permissibleFuelTypes: z.array(z.enum(ACCEPTED_FUEL_TYPES)).min(1),
  burnSequences: z.array(BurnSequenceEntrySchema),
})

const ArmLookupEntrySchema = z.object({
  massOrVolume: z.number(),
  moment: z.number(),
})

const LoadPointSchema = z.object({
  name: z.string().min(1),
  arm: z.number().nullable(),
  armLookup: z.array(ArmLookupEntrySchema),
  operationalLimit: z.number().nonnegative().nullable(),
  defaultQuantity: z.number().nonnegative(),
  unit: z.string().min(1),
  allowableCategories: z.array(z.enum(['Normal', 'Utility', 'Aerobatic'])).nullable(),
  fuelTank: FuelTankSchema.nullable(),
})

const EnvelopePointSchema = z.object({
  armOrMoment: z.number(),
  mass: z.number(),
})

const CategoryDefinitionSchema = z.object({
  category: z.enum(['Normal', 'Utility', 'Aerobatic']),
  maxTakeoffMass: z.number().positive(),
  maxZeroFuelMass: z.number().positive().nullable(),
  graphType: z.enum(['arm', 'moment']),
  envelope: z.array(EnvelopePointSchema).min(3),
})

const WeighingReportSchema = z.object({
  basicEmptyMass: z.number().positive(),
  emptyCg: z.number(),
  weighingDate: z.string().min(1),
  validFrom: z.string().min(1),
})

// @IMP-MB-DATA-002@ (FROM: @REQ-AD-020@, @REQ-AD-021@)
const BatteryPackSchema = z.object({
  usableEnergyKwh: z.number().positive(),
  reserveFloorKwh: z.number().nonnegative(),
  nominalVoltage: z.number().positive().optional(),
  chemistry: z.string().min(1).optional(),
})

// @IMP-MB-DATA-001@ (FROM: @REQ-MB-002@, @DES-ARCH-005@, @REQ-AC-005@)
export const AircraftContextSchema = z.object({
  id: z.string().min(1),
  registration: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  sourceUnit: z.string().min(1),
  status: z
    .union([
      z.literal('draft'),
      z.literal('verified'),
      z.literal('Draft').transform((): 'draft' => 'draft'),
      z.literal('Verified').transform((): 'verified' => 'verified'),
    ])
    .default('verified'),
  // Powertrain — omitted on legacy records, defaulting to combustion so the
  // M&B view preserves its existing fuel-centric render for every pre-PIVE
  // aircraft without any data migration.
  powertrain: z.enum(['combustion', 'electric']).default('combustion'),
  batteryPack: BatteryPackSchema.optional(),
  weighingReports: z.array(WeighingReportSchema).min(1),
  loadPoints: z.array(LoadPointSchema),
  certificationCategories: z.array(CategoryDefinitionSchema).min(1),
})
