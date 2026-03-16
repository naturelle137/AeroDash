/**
 * Mass & Balance mathematical core logic.
 * Pure mathematical functions. P1 Safety Core.
 * Assumes validated mathematical input constraints.
 */
import type { MathCoreInput, MathCoreResult, Violation } from '../domain/mass-balance.math-types'
import type { CgPoint, MigrationPoint } from '../domain/mass-balance.math-types'
import type { ArmLookupEntry } from '../domain/aircraft.types'

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
    const isFuel = input.fuelStations.some((fs) => fs.index === s.index)
    if (!isFuel) {
      const arm: number = s.armLookup.length > 0 ? lookupArm(s.mass, s.armLookup) : (s.arm ?? 0)
      zeroFuelMass += s.mass
      zeroFuelMoment += s.mass * arm
    }
  }
  const zeroFuelCenterOfGravityPoint: CgPoint = {
    arm: zeroFuelMass > 0 ? zeroFuelMoment / zeroFuelMass : 0,
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
    const usableMass = Math.max(0, fs.mass - fs.unusableFuel)
    const arm: number = fs.armLookup.length > 0 ? lookupArm(fs.mass, fs.armLookup) : (fs.arm ?? 0)
    takeoffMass += usableMass
    takeoffMoment += usableMass * arm
  }

  // @IMP-MB-CORE-005@ (FROM: @REQ-MB-008@)
  const takeoffCenterOfGravityPoint: CgPoint = {
    arm: takeoffMass > 0 ? takeoffMoment / takeoffMass : 0,
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
    arm: landingMass > 0 ? landingMoment / landingMass : 0,
    mass: landingMass,
    moment: landingMoment,
  }

  // @IMP-MB-CORE-007@ (FROM: @REQ-MB-008@)
  const migrationPath: MigrationPoint[] = []

  migrationPath.push({ ...takeoffCenterOfGravityPoint, label: 'Takeoff' })

  // If there are multiple fuel tanks with burn sequences, we would calculate intermediate points here.
  // For the MVP, we just do a straight line Takeoff -> Landing.
  migrationPath.push({ ...landingCenterOfGravityPoint, label: 'Landing' })

  // @IMP-MB-CORE-008@ (FROM: @REQ-MB-006@)
  const envelopeVertices = input.envelope.map((p) => ({ x: p.armOrMoment, y: p.mass }))

  // @IMP-MB-CORE-009@ (FROM: @REQ-MB-004@, @REQ-MB-011@)
  const takeoffX = input.graphType === 'arm' ? takeoffCenterOfGravityPoint.arm : takeoffMoment
  if (!isPointInPolygon(takeoffX, takeoffCenterOfGravityPoint.mass, envelopeVertices)) {
    violations.push({
      type: 'CG_OUT_OF_ENVELOPE',
    })
  }

  // @IMP-MB-CORE-010@ (FROM: @REQ-MB-011@)
  const landingX = input.graphType === 'arm' ? landingCenterOfGravityPoint.arm : landingMoment
  if (
    !isPointInPolygon(landingX, landingCenterOfGravityPoint.mass, envelopeVertices) &&
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

// @IMP-MB-CORE-011@ (FROM: @REQ-MB-007@)
export function isPointInPolygon(
  x: number,
  y: number,
  vertices: { x: number; y: number }[],
): boolean {
  if (vertices.length < 3) throw new Error('Invalid Input: Envelope must have at least 3 vertices.')
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i]!.x,
      yi = vertices[i]!.y
    const xj = vertices[j]!.x,
      yj = vertices[j]!.y

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// @IMP-MB-CORE-012@ (FROM: @REQ-MB-012@)
/**
 * Linear interpolation for arm lookup tables.
 * Arm = Moment / Mass (or Volume).
 */
function lookupArm(mass: number, lookup: ArmLookupEntry[]): number {
  /* v8 ignore start */
  // computeMassBalanceCore prevents this from happening, fail safe if function is ever exported
  if (lookup.length === 0) throw new Error('Invalid Input: armLookup has an invalid input.')
  /* v8 ignore stop */
  if (mass === 0) {
    return lookup[0]!.massOrVolume > 0 ? lookup[0]!.moment / lookup[0]!.massOrVolume : 0
  }
  if (lookup.length === 1) return lookup[0]!.moment / lookup[0]!.massOrVolume

  const sorted = [...lookup].sort((a, b) => a.massOrVolume - b.massOrVolume)

  if (mass <= sorted[0]!.massOrVolume) return sorted[0]!.moment / sorted[0]!.massOrVolume
  if (mass >= sorted[sorted.length - 1]!.massOrVolume)
    return sorted[sorted.length - 1]!.moment / sorted[sorted.length - 1]!.massOrVolume

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i]!
    const p2 = sorted[i + 1]!
    if (mass >= p1.massOrVolume && mass <= p2.massOrVolume) {
      const ratio = (mass - p1.massOrVolume) / (p2.massOrVolume - p1.massOrVolume)
      const moment = p1.moment + ratio * (p2.moment - p1.moment)
      return moment / mass
    }
  }

  throw new Error('Invalid Input: armLookup has an invalid input.')
}
