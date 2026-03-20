/**
 * Mass & Balance mathematical core logic.
 * Pure mathematical functions. P1 Safety Core.
 * Assumes validated mathematical input constraints.
 */
import type { MathCoreInput, MathCoreResult, Violation } from '../domain/mass-balance.math-types'
import type { CgPoint, MigrationPoint } from '../domain/mass-balance.math-types'
import { interpolateArmFromLookup } from './mb.arm-lookup'
import { isCgWithinEnvelope } from './mb.envelope'

/**
 * Synchronously calculate mass, CG, and geometric domain safety violations.
 *
 * The result is captured wholesale — `violations` replaces the store's violation state.
 *
 * @param input - Assembled and structurally validated input.
 * @returns Complete calculation result with domain violations.
 */
export function computeMassBalanceCore(input: MathCoreInput): MathCoreResult {
  const violations: Violation[] = []

  // Zero Fuel Mass = Basic Empty Mass + sum(masses of non-fuel stations)
  let zeroFuelMass = input.basicEmptyMass
  let zeroFuelMoment = input.basicEmptyMass * input.emptyCenterOfGravity

  // @IMP-MB-CORE-001@ (FROM: @REQ-MB-009@)
  for (const s of input.stations) {
    if (s.armLookup.length === 0 && s.arm === null) {
      throw new Error(
        `CRITICAL DOMAIN ERROR: Station ${s.index} is missing both arm and armLookup.`,
      )
    }

    const arm: number =
      s.armLookup.length > 0 ? interpolateArmFromLookup(s.mass, s.armLookup) : s.arm!
    zeroFuelMass += s.mass
    zeroFuelMoment += s.mass * arm
  }

  if (zeroFuelMass <= 0) {
    throw new Error(
      'CRITICAL DOMAIN ERROR: zeroFuelMass is <= 0. Cannot compute center of gravity.',
    )
  }

  const zeroFuelCenterOfGravityPoint: CgPoint = {
    arm: zeroFuelMoment / zeroFuelMass,
    mass: zeroFuelMass,
    moment: zeroFuelMoment,
  }

  if (input.maxZeroFuelMass !== null && zeroFuelCenterOfGravityPoint.mass > input.maxZeroFuelMass) {
    violations.push({
      type: 'MZFM_EXCEEDED',
    })
  }

  // @IMP-MB-CORE-002@ (FROM: @REQ-MB-008@)
  // Takeoff Mass = Zero Fuel Mass + sum(usable fuel masses)
  // Unusable fuel is already included in basicEmptyMass, so only usable fuel is added here.
  let takeoffMass = zeroFuelCenterOfGravityPoint.mass
  let takeoffMoment = zeroFuelMoment

  for (const fs of input.fuelStations) {
    if (fs.armLookup.length === 0 && fs.arm === null) {
      throw new Error(
        `CRITICAL DOMAIN ERROR: Fuel Station ${fs.index} is missing both arm and armLookup.`,
      )
    }

    const usableMass = Math.max(0, fs.mass - fs.unusableFuel)
    const arm: number =
      fs.armLookup.length > 0 ? interpolateArmFromLookup(fs.mass, fs.armLookup) : fs.arm!
    takeoffMass += usableMass
    takeoffMoment += usableMass * arm
  }

  // @IMP-MB-CORE-005@ (FROM: @REQ-MB-008@)
  const takeoffCenterOfGravityPoint: CgPoint = {
    arm: takeoffMoment / takeoffMass,
    mass: takeoffMass,
    moment: takeoffMoment,
  }

  // @IMP-MB-CORE-003@ (FROM: @REQ-MB-005@)
  if (takeoffMass > input.maxTakeoffMass) {
    violations.push({
      type: 'MTOM_EXCEEDED',
    })
  }

  // @IMP-MB-CORE-004@ (FROM: @REQ-MB-008@)
  // For the current MVP logic, we just migrate from TOM to ZFM and assume all usable fuel is burned.
  // Landing Mass = Zero Fuel Mass
  // TODO: In a more complex version, the user might input planned fuel burn.
  const landingMass = zeroFuelMass
  const landingMoment = zeroFuelMoment

  // @IMP-MB-CORE-006@ (FROM: @REQ-MB-008@)
  const landingCenterOfGravityPoint: CgPoint = {
    arm: landingMoment / landingMass,
    mass: landingMass,
    moment: landingMoment,
  }

  // @IMP-MB-CORE-007@ (FROM: @REQ-MB-008@)
  const migrationPath: MigrationPoint[] = []

  migrationPath.push({ ...takeoffCenterOfGravityPoint, label: 'Takeoff' })

  // If there are multiple fuel tanks with burn sequences, we would calculate intermediate points here.
  // For the MVP, we just do a straight line Takeoff -> Landing.
  migrationPath.push({ ...landingCenterOfGravityPoint, label: 'Landing' })

  // @IMP-MB-CORE-008@ (FROM: @REQ-MB-006@, @REQ-MB-004@, @REQ-MB-011@)
  const takeoffX = input.graphType === 'arm' ? takeoffCenterOfGravityPoint.arm : takeoffMoment
  if (!isCgWithinEnvelope(takeoffX, takeoffCenterOfGravityPoint.mass, input.envelope)) {
    violations.push({
      type: 'CG_OUT_OF_ENVELOPE',
    })
  }

  // @IMP-MB-CORE-010@ (FROM: @REQ-MB-011@)
  const landingX = input.graphType === 'arm' ? landingCenterOfGravityPoint.arm : landingMoment
  if (
    !isCgWithinEnvelope(landingX, landingCenterOfGravityPoint.mass, input.envelope) &&
    !violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')
  ) {
    violations.push({
      type: 'CG_MIGRATION_EXCEEDED',
    })
  }

  return {
    zeroFuelCenterOfGravityPoint,
    takeoffCenterOfGravityPoint,
    landingCenterOfGravityPoint,
    migrationPath,
    violations,
    success: true,
  }
}
