import type { MathCoreInput, MathCoreResult, Violation } from './mass-balance.math-types'
import type { CgPoint, MigrationPoint } from './mass-balance.math-types'
import type { ArmLookupEntry } from '../aircraft/aircraft.types'

/**
 * Synchronously calculate mass, CG, and safety violations.
 *
 * The store calls this on every input mutation. The result is captured
 * wholesale — `violations` replaces the store's violation state,
 * and the store maps these to UI notifications.
 *
 * @param input - Assembled input from the store's raw state.
 * @returns Complete calculation result with raw violations.
 */
// @IMP-MB-005@ (FROM: @DES-ARCH-005@)
export function calculateMassBalance(input: MathCoreInput): MathCoreResult {
  const violations: Violation[] = []

  // Zero Fuel Mass = Basic Empty Mass + sum(weights of non-fuel stations)
  let zeroFuelMass = input.basicEmptyMass
  let zeroFuelMoment = input.basicEmptyMass * input.emptyCenterOfGravity

  for (const s of input.stations) {
    const isFuel = input.fuelStations.some((fs) => fs.index === s.index)
    if (!isFuel) {
      const arm = s.armLookup ? lookupArm(s.weight, s.armLookup) : (s.arm ?? 0)
      zeroFuelMass += s.weight
      zeroFuelMoment += s.weight * (arm ?? 0)
    }
  }

  // @IMP-MB-001@ (FROM: @REQ-MB-009@)
  if (input.maxZeroFuelMass !== null && zeroFuelMass > input.maxZeroFuelMass) {
    violations.push({
      type: 'MZFM_EXCEEDED',
      severity: 'CRITICAL',
    })
  }

  // Takeoff Mass = Zero Fuel Mass + sum(weights of fuel stations)
  let takeoffMass = zeroFuelMass
  let takeoffMoment = zeroFuelMoment

  for (const fs of input.fuelStations) {
    const arm = fs.armLookup ? lookupArm(fs.weight, fs.armLookup) : (fs.arm ?? 0)
    takeoffMass += fs.weight
    takeoffMoment += fs.weight * (arm ?? 0)
  }

  // @IMP-MB-002@ (FROM: @REQ-MB-005@)
  if (takeoffMass > input.maxTakeoffMass) {
    violations.push({
      type: 'MTOM_EXCEEDED',
      severity: 'CRITICAL',
    })
  }

  // Landing Mass = Takeoff Mass - sum(usable fuel)
  // For now, we assume all fuel is burned except unusable.
  // TODO: In a more complex version, the user might input planned fuel burn.
  // For the current MVP logic, we migration from TOM to ZFM + unusable fuel.
  let landingMass = zeroFuelMass
  let landingMoment = zeroFuelMoment

  for (const fs of input.fuelStations) {
    const unusableWeight = fs.unusableFuel // Assuming unusableFuel is already in weight units for this calculation
    const arm = fs.armLookup ? lookupArm(unusableWeight, fs.armLookup) : (fs.arm ?? 0)
    landingMass += unusableWeight
    landingMoment += unusableWeight * (arm ?? 0)
  }

  // @IMP-MB-003@ (FROM: @REQ-MB-008@)
  const takeoffCenterOfGravity: CgPoint = {
    mass: takeoffMass,
    arm: takeoffMass > 0 ? takeoffMoment / takeoffMass : 0,
  }

  // @IMP-MB-004@ (FROM: @REQ-MB-008@)
  const landingCenterOfGravity: CgPoint = {
    mass: landingMass,
    arm: landingMass > 0 ? landingMoment / landingMass : 0,
  }

  // @IMP-MB-006@ (FROM: @REQ-MB-008@, @DES-UX-009@)
  const migrationPath: MigrationPoint[] = []

  migrationPath.push({ ...takeoffCenterOfGravity, label: 'Takeoff' })

  // If there are multiple fuel tanks with burn sequences, we would calculate intermediate points here.
  // For the MVP, we just do a straight line Takeoff -> Landing.
  migrationPath.push({ ...landingCenterOfGravity, label: 'Landing' })

  // @IMP-MB-007@ (FROM: @REQ-MB-006@)
  const envelopeVertices = input.envelope.map((p) => ({ x: p.armOrMoment, y: p.mass }))

  // @IMP-MB-009@ (FROM: @REQ-MB-004@)
  const takeoffX = input.graphType === 'arm' ? takeoffCenterOfGravity.arm : takeoffMoment
  if (!isPointInPolygon(takeoffX, takeoffCenterOfGravity.mass, envelopeVertices)) {
    violations.push({
      type: 'CG_OUT_OF_ENVELOPE',
      severity: 'CRITICAL',
    })
  }

  // @IMP-MB-005@ (FROM: @REQ-MB-011@)
  const landingX = input.graphType === 'arm' ? landingCenterOfGravity.arm : landingMoment
  if (
    !isPointInPolygon(landingX, landingCenterOfGravity.mass, envelopeVertices) &&
    !violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')
  ) {
    violations.push({
      type: 'CG_MIGRATION_EXCEEDED',
      severity: 'CRITICAL',
    })
  }

  return {
    takeoffMass: takeoffMass,
    zeroFuelMass: zeroFuelMass,
    centerOfGravityPosition: takeoffCenterOfGravity.arm,
    landingMass: landingMass,
    takeoffCenterOfGravity,
    landingCenterOfGravity,
    migrationPath,
    violations,
  }
}

// @IMP-MB-006@ (FROM: @REQ-MB-007@)
function isPointInPolygon(x: number, y: number, vertices: { x: number; y: number }[]): boolean {
  if (vertices.length < 3) return false
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

// @IMP-MB-010@ (FROM: @REQ-MB-012@)
/**
 * Linear interpolation for arm lookup tables.
 * Arm = Moment / Mass (or Volume).
 */
function lookupArm(weight: number, lookup: ArmLookupEntry[]): number {
  if (lookup.length === 0) return 0
  if (weight === 0) {
    return lookup[0]!.massOrVolume > 0 ? lookup[0]!.moment / lookup[0]!.massOrVolume : 0
  }
  if (lookup.length === 1) return lookup[0]!.moment / lookup[0]!.massOrVolume

  const sorted = [...lookup].sort((a, b) => a.massOrVolume - b.massOrVolume)

  if (weight <= sorted[0]!.massOrVolume) return sorted[0]!.moment / sorted[0]!.massOrVolume
  if (weight >= sorted[sorted.length - 1]!.massOrVolume)
    return sorted[sorted.length - 1]!.moment / sorted[sorted.length - 1]!.massOrVolume

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i]!
    const p2 = sorted[i + 1]!
    if (weight >= p1.massOrVolume && weight <= p2.massOrVolume) {
      const ratio = (weight - p1.massOrVolume) / (p2.massOrVolume - p1.massOrVolume)
      const moment = p1.moment + ratio * (p2.moment - p1.moment)
      return moment / weight
    }
  }
  return 0
}
