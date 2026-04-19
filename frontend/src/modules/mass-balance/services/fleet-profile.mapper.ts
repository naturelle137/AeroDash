/**
 * Maps an `AircraftProfile` (fleet/IndexedDB aggregate root) to the
 * `AircraftContext` subset consumed by the Mass & Balance store.
 *
 * The two types use different field names for historical reasons:
 *  - `AircraftProfile.weighingReports[].bem`      → `AircraftContext.weighingReports[].basicEmptyMass`
 *  - `AircraftProfile.certificationCategories[].mtom` → `AircraftContext.certificationCategories[].maxTakeoffMass`
 *
 * All other fields are structurally compatible.
 *
 * @module mass-balance/services/fleet-profile.mapper
 * @see AircraftContext in `@/core/domain/aircraft.types`
 * @see AircraftProfile in `@/core/adapters/aircraft.schema`
 */

// @IMP-MB-SVC-001@ (FROM: @REQ-MB-002@, @REQ-AC-005@)

import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import type { AircraftContext } from '@/core/domain/aircraft.types'

/**
 * Convert a fleet `AircraftProfile` into the `AircraftContext` shape
 * required by the Mass & Balance store.
 *
 * This is a pure, deterministic mapping — no async I/O, no side effects.
 * The caller is responsible for validation via `AircraftContextSchema.safeParse`.
 */
export function mapFleetProfileToContext(profile: AircraftProfile): AircraftContext {
  return {
    id: profile.id,
    registration: profile.registration,
    manufacturer: profile.manufacturer,
    model: profile.model,
    sourceUnit: profile.sourceUnit,
    status: profile.status,
    weighingReports: profile.weighingReports.map((wr) => ({
      basicEmptyMass: wr.bem,
      emptyCg: wr.emptyCg,
      weighingDate: wr.weighingDate,
      validFrom: wr.validFrom,
    })),
    loadPoints: profile.loadPoints.map((lp) => ({
      name: lp.name,
      arm: lp.arm,
      armLookup: lp.armLookup,
      operationalLimit: lp.operationalLimit,
      defaultQuantity: lp.defaultQuantity,
      unit: lp.unit,
      allowableCategories: lp.allowableCategories,
      fuelTank: lp.fuelTank
        ? {
            unusableFuel: lp.fuelTank.unusableFuel,
            permissibleFuelTypes: lp.fuelTank.permissibleFuelTypes,
            burnSequences: lp.fuelTank.burnSequences,
          }
        : null,
    })),
    certificationCategories: profile.certificationCategories.map((cc) => ({
      category: cc.category,
      maxTakeoffMass: cc.mtom,
      maxZeroFuelMass: cc.maxZeroFuelMass,
      graphType: cc.graphType,
      envelope: cc.envelope,
    })),
  }
}
