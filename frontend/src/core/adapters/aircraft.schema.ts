import { z } from 'zod'
import { CANONICAL_FUEL_TYPES } from '../logic/fuel-density'

/**
 * Canonical Zod schemas for the AircraftProfile aggregate-root document.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * M2 (Basic M&B): All fields in this file except the M3/M4 placeholder
 * fields are strictly validated.
 *
 * M3 (Aircraft Fleet Management): Added status, schemaVersion,
 * passengerProfiles, costPerHour, and checklistScaffold fields.
 *
 * M4 (Performance): performanceProfiles fully typed with flight phase
 * enumeration and up to 1000 data points per profile (REQ-AD-008, REQ-AD-009).
 * fuelCostIncluded flag added alongside costPerHour (REQ-AD-006).
 *
 * @see docs/architecture/aircraft_data_model.md
 * @see docs/architecture/adr/003-aircraft-data-model.md
 * @see docs/architecture/adr/006-indexeddb-fleet-persistence.md
 */

// @IMP-AD-CORE-022@ (FROM: @REQ-AD-002@, @REQ-AD-014@, @REQ-SYS-003@)
// All numeric profile fields are `.finite()`: Zod's `z.number()` (incl.
// `.positive()`/`.nonnegative()`) accepts ±Infinity, which would propagate to
// the M&B math core as Infinity → CG = NaN with `success: true` (TECH-003 /
// CS-002). Profile documents are stored at rest in their SOURCE unit
// (REQ-AD-014: mass kg|lb, arm m|in|ft, moment kg·m|in-lb), so the bounds here
// are intentionally generous — wide enough for the largest supported unit
// (lb ≈ 2.2× kg, in ≈ 39× m) while still rejecting absurd magnitudes
// (1e30 / 1e308) that can only be tampering or corruption.
const MAX_MASS_SRC = 500_000 // 200 t in kg ≈ 440k lb → 500k covers both
const MAX_LEN_SRC = 5_000 // 100 m ≈ 3937 in ≈ 328 ft → 5000 covers all arm units
const MAX_MOMENT_SRC = 1_000_000_000 // generous: covers lb·in moment magnitudes
const MAX_ENERGY_KWH = 2_000 // largest credible GA battery pack
const MAX_VOLTAGE_V = 2_000

/** Finite number (rejects NaN and ±Infinity). */
const finiteNum = () => z.number().finite()
/** Finite mass (source unit), bounded but unsigned-constraint left to caller. */
const finiteMass = () => finiteNum().max(MAX_MASS_SRC)
/** Finite length/arm (source unit), may be negative (datum behind station). */
const finiteLen = () => finiteNum().min(-MAX_LEN_SRC).max(MAX_LEN_SRC)
/** Finite moment (source unit), may be negative. */
const finiteMoment = () => finiteNum().min(-MAX_MOMENT_SRC).max(MAX_MOMENT_SRC)

const ArmLookupEntrySchema = z.object({
  massOrVolume: finiteMass().nonnegative(),
  moment: finiteMoment(),
})

const BurnSequenceEntrySchema = z.object({
  sequenceName: z.string().min(1),
  ordinalPosition: z.number().int().positive(),
})

const FuelTankExtensionSchema = z.object({
  unusableFuel: finiteMass().nonnegative(),
  permissibleFuelTypes: z.array(z.enum(CANONICAL_FUEL_TYPES)).min(1),
  burnSequences: z.array(BurnSequenceEntrySchema),
})

// @IMP-AD-CORE-018@ (FROM: @REQ-AD-020@, @REQ-AD-021@)
// Battery pack description for battery-electric aircraft. A single pack per
// aircraft at v1 — multi-pack topologies (redundant strings, motor-glider
// hybrids) are deferred. Mass is a fixed contribution to BEM and does NOT
// change with state of charge (unlike fuel), which is why it lives here
// rather than as a load station quantity.
const BatteryPackSchema = z.object({
  /** Nameplate usable energy at 100% SoC, in kWh. */
  usableEnergyKwh: finiteNum().positive().max(MAX_ENERGY_KWH),
  /**
   * Reserve floor below which operation is prohibited by POH/AFM (kWh).
   * Must be < usableEnergyKwh so there is always a usable working band.
   */
  reserveFloorKwh: finiteNum().nonnegative().max(MAX_ENERGY_KWH),
  /** Optional nominal voltage (V) — used for future derating lookups. */
  nominalVoltage: finiteNum().positive().max(MAX_VOLTAGE_V).optional(),
  /**
   * Optional cell chemistry free-text label (e.g. "LiFePO4", "NMC").
   * Not enumerated — regulatory labelling is still evolving for aviation
   * batteries. Informational only at v1.
   */
  chemistry: z.string().min(1).optional(),
})

const LoadPointSchema = z.object({
  name: z.string().min(1),
  arm: finiteLen().nullable(),
  armLookup: z.array(ArmLookupEntrySchema).default([]),
  operationalLimit: finiteMass().nonnegative().nullable(),
  defaultQuantity: finiteMass().nonnegative(),
  unit: z.string().min(1),
  allowableCategories: z.array(z.enum(['Normal', 'Utility', 'Aerobatic'])).nullable(),
  fuelTank: FuelTankExtensionSchema.nullable(),
})

const EnvelopePointSchema = z.object({
  // armOrMoment is an arm (length) in arm-graph mode or a moment in
  // moment-graph mode; the moment bound is the wider of the two.
  armOrMoment: finiteMoment(),
  mass: finiteMass().nonnegative(),
})

const CertificationCategorySchema = z.object({
  category: z.enum(['Normal', 'Utility', 'Aerobatic']),
  mtom: finiteMass().positive(),
  maxZeroFuelMass: finiteMass().positive().nullable(),
  graphType: z.enum(['arm', 'moment']),
  envelope: z.array(EnvelopePointSchema).min(4).max(20),
})

// @IMP-AD-CORE-005@ (FROM: @REQ-AD-004@)
const WeighingReportSchema = z.object({
  bem: finiteMass().positive(),
  emptyCg: finiteLen(),
  weighingDate: z.string().min(1),
  // @IMP-AD-CORE-013@ (FROM: @REQ-AD-013@)
  validFrom: z.string().min(1),
})

// @IMP-AD-CORE-009@ (FROM: @REQ-AD-017@)
const WindLimitSchema = z.object({
  component: z.enum(['MaxCrosswind', 'MaxTailwind', 'MaxTotalWind', 'MaxGust']),
  value: finiteNum().nonnegative(),
  classification: z.enum(['Demonstrated', 'Limit']),
})

// @IMP-AD-CORE-010@ (FROM: @REQ-AD-015@)
const SurfaceConditionSchema = z.object({
  name: z.string().min(1),
  takeoffFactor: finiteNum().positive(),
  landingFactor: finiteNum().positive(),
})

// @IMP-AD-CORE-011@ (FROM: @REQ-AD-016@)
const SafetyFactorsSchema = z.object({
  takeoff: finiteNum().positive(),
  landing: finiteNum().positive(),
})

// @IMP-AC-CORE-001@ (FROM: @REQ-AC-005@, @REQ-AC-006@)
const PassengerProfileSchema = z.object({
  name: z.string().min(1),
  standardWeight: finiteMass().positive(),
  unit: z.enum(['kg', 'lbs']),
})

// @IMP-AD-CORE-008@ (FROM: @REQ-AD-006@, @REQ-AD-010@)
const ChecklistScaffoldItemSchema = z.object({
  title: z.string().min(1),
  items: z.array(z.string()),
})

// @IMP-AD-CORE-015@ (FROM: @REQ-AD-009@, @DES-ARCH-002@)
const PerformanceDataPointSchema = z.object({
  distance: finiteNum().nonnegative(),
  mass: finiteMass().positive(),
  pressureAltitude: finiteNum(),
  temperature: finiteNum(),
})

// @IMP-AD-CORE-014@ (FROM: @REQ-AD-008@, @REQ-AD-009@, @DES-ARCH-002@)
const PerformanceProfileSchema = z.object({
  flightPhase: z.enum([
    'TakeoffRoll',
    'TakeoffDistance50ft',
    'LandingRoll',
    'LandingDistance50ft',
  ]),
  dataPoints: z.array(PerformanceDataPointSchema).max(1000),
})

// @IMP-AD-CORE-004@ (FROM: @REQ-AD-001@, @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@, @REQ-AD-014@, @DES-ARCH-002@)
// @IMP-AC-CORE-002@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AC-006@, @REQ-AD-006@, @REQ-AD-007@, @REQ-AD-010@)
export const AircraftProfileSchema = z
  .object({
    id: z.string().uuid(),
    // @IMP-AD-CORE-012@ (FROM: @REQ-AD-019@)
    ownerId: z.string().min(1),
    registration: z.string().min(1),
    manufacturer: z.string().min(1),
    model: z.string().min(1),
    icaoTypeDesignator: z.string().min(1),
    sourceUnit: z.string().min(1),
    referenceDatumDescription: z.string().min(1),
    referenceDatumLocation: z.string().min(1),
    shareCode: z.string().nullable(),
    // M3: Profile status for draft/verified FSM (REQ-AC-005, H-011). Lowercase is canonical;
    // legacy Title-Case values from IndexedDB / exchange files normalize on parse.
    status: z
      .union([
        z.literal('draft'),
        z.literal('verified'),
        z.literal('Draft').transform((): 'draft' => 'draft'),
        z.literal('Verified').transform((): 'verified' => 'verified'),
      ])
      .default('draft'),
    // M3: Schema version for structured migration safety (refs #154)
    schemaVersion: z.number().int().positive().finite().default(1),
    // M3: Passenger profiles with standard weights (REQ-AC-006)
    passengerProfiles: z.array(PassengerProfileSchema).default([]),
    weighingReports: z.array(WeighingReportSchema).min(1),
    loadPoints: z.array(LoadPointSchema).max(20),
    certificationCategories: z.array(CertificationCategorySchema).min(1),
    windLimits: z.array(WindLimitSchema).optional(),
    surfaceConditions: z.array(SurfaceConditionSchema).optional(),
    safetyFactors: SafetyFactorsSchema.optional(),
    // M3: Supplementary fields (REQ-AD-006, REQ-AD-007)
    costPerHour: finiteNum().nonnegative().optional(),
    // @IMP-AD-CORE-016@ (FROM: @REQ-AD-006@)
    fuelCostIncluded: z.boolean().optional(),
    checklistScaffold: z.array(ChecklistScaffoldItemSchema).optional(),
    // M4: Performance profiles fully typed (REQ-AD-008, REQ-AD-009)
    performanceProfiles: z.array(PerformanceProfileSchema).optional(),
    // M3.5: Powertrain discriminator (REQ-AD-020). Legacy combustion-only
    // profiles omit this field and default to 'combustion' on parse, so
    // IndexedDB records persisted before electric support remain valid
    // without any explicit migration write.
    powertrain: z.enum(['combustion', 'electric']).default('combustion'),
    // M3.5: Battery pack is required when powertrain === 'electric' and
    // forbidden otherwise. The presence / absence constraint is enforced in
    // the superRefine below so the Zod error surface is one level up from
    // a field-level "missing" message.
    batteryPack: BatteryPackSchema.optional(),
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

    // @IMP-AD-CORE-019@ (FROM: @REQ-AD-020@, @REQ-AD-021@)
    // Powertrain / BatteryPack consistency. Deliberately modelled via
    // superRefine rather than a Zod discriminated union so the rest of
    // AircraftProfile's sprawling optional surface (performanceProfiles,
    // windLimits, …) doesn't have to be duplicated across both branches.
    if (data.powertrain === 'electric') {
      if (!data.batteryPack) {
        ctx.addIssue({
          code: 'custom',
          message: 'BATTERY_PACK_REQUIRED_FOR_ELECTRIC',
          path: ['batteryPack'],
        })
      } else if (data.batteryPack.reserveFloorKwh >= data.batteryPack.usableEnergyKwh) {
        // Reserve must leave a usable working band. Reserve equal to the
        // full pack means the aircraft is always below the operational
        // floor — a configuration error, not a runtime state.
        ctx.addIssue({
          code: 'custom',
          message: 'RESERVE_EXCEEDS_USABLE_ENERGY',
          path: ['batteryPack', 'reserveFloorKwh'],
        })
      }
      // Electric aircraft must not carry fuel tanks — Carsten (#225): "do
      // not try to fit an electric plane in the classical fuel schema".
      // We surface this as a hard validation so import/export files with
      // mismatched topologies cannot be persisted in a broken state.
      if (fuelTankCount > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'ELECTRIC_AIRCRAFT_HAS_FUEL_TANK',
          path: ['loadPoints'],
        })
      }
    } else {
      // powertrain === 'combustion': no batteryPack allowed.
      if (data.batteryPack !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION',
          path: ['batteryPack'],
        })
      }
    }
  })

export type AircraftProfile = z.infer<typeof AircraftProfileSchema>
export type AircraftProfileLoadPoint = z.infer<typeof LoadPointSchema>
export type AircraftProfileFuelTankExtension = z.infer<typeof FuelTankExtensionSchema>
export type AircraftProfileCertificationCategory = z.infer<typeof CertificationCategorySchema>
export type AircraftProfileWeighingReport = z.infer<typeof WeighingReportSchema>
export type AircraftProfileWindLimit = z.infer<typeof WindLimitSchema>
export type AircraftProfileSurfaceCondition = z.infer<typeof SurfaceConditionSchema>
export type AircraftProfileSafetyFactors = z.infer<typeof SafetyFactorsSchema>
// M3 types
export type AircraftProfileStatus = z.infer<typeof AircraftProfileSchema>['status']
export type AircraftProfilePassengerProfile = z.infer<typeof PassengerProfileSchema>
export type AircraftProfileChecklistScaffoldItem = z.infer<typeof ChecklistScaffoldItemSchema>
// M4 types
export type AircraftProfilePerformanceProfile = z.infer<typeof PerformanceProfileSchema>
export type AircraftProfilePerformanceDataPoint = z.infer<typeof PerformanceDataPointSchema>
// M3.5 types — powertrain discriminator + battery pack
export type AircraftProfilePowertrain = z.infer<typeof AircraftProfileSchema>['powertrain']
export type AircraftProfileBatteryPack = z.infer<typeof BatteryPackSchema>
