/**
 * Mass & Balance mathematical core logic.
 * Pure mathematical functions. P1 Safety Core.
 * Assumes validated mathematical input constraints.
 */
import type { MathCoreInput, MathCoreResult, Violation } from '../domain/mass-balance.math-types'
import type { CgPoint, MigrationPoint } from '../domain/mass-balance.math-types'
import { interpolateArmFromLookup } from './mb.arm-lookup'
import { isCgWithinEnvelope, doesSegmentCrossEnvelope } from './mb.envelope'

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
  // Pre-resolve arm and usable mass for each fuel station.
  // Unusable fuel is already included in basicEmptyMass, so only usable fuel is added.
  const resolvedFuel = input.fuelStations.map((fs) => {
    if (fs.armLookup.length === 0 && fs.arm === null) {
      throw new Error(
        `CRITICAL DOMAIN ERROR: Fuel Station ${fs.index} is missing both arm and armLookup.`,
      )
    }
    const resolvedArm: number =
      fs.armLookup.length > 0 ? interpolateArmFromLookup(fs.mass, fs.armLookup) : fs.arm!
    return { ...fs, resolvedArm, usableMass: Math.max(0, fs.mass - fs.unusableFuel) }
  })

  let takeoffMass = zeroFuelCenterOfGravityPoint.mass
  let takeoffMoment = zeroFuelMoment
  for (const rf of resolvedFuel) {
    takeoffMass += rf.usableMass
    takeoffMoment += rf.usableMass * rf.resolvedArm
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
  // Landing Mass = Zero Fuel Mass (all usable fuel burned).
  const landingMass = zeroFuelMass
  const landingMoment = zeroFuelMoment

  // @IMP-MB-CORE-006@ (FROM: @REQ-MB-008@)
  const landingCenterOfGravityPoint: CgPoint = {
    arm: landingMoment / landingMass,
    mass: landingMass,
    moment: landingMoment,
  }

  // @IMP-MB-CORE-007@ (FROM: @REQ-MB-008@, @REQ-FE-004@)
  // Compute intermediate CG waypoints for multi-tank burn sequences.
  // Each named sequence defines the order in which tanks are drained.
  // Draining each tank (except the last) produces an intermediate CG point.
  const sequenceNames = new Set<string>()
  for (const rf of resolvedFuel) {
    for (const bs of rf.burnSequences) {
      sequenceNames.add(bs.sequenceName)
    }
  }

  const burnSequenceWaypoints: MigrationPoint[] = []

  for (const seqName of sequenceNames) {
    const ordered = resolvedFuel
      .filter((rf) => rf.burnSequences.some((bs) => bs.sequenceName === seqName))
      .sort((a, b) => {
        const ordA = a.burnSequences.find((bs) => bs.sequenceName === seqName)!.ordinalPosition
        const ordB = b.burnSequences.find((bs) => bs.sequenceName === seqName)!.ordinalPosition
        return ordA - ordB
      })

    let curMass = takeoffMass
    let curMoment = takeoffMoment

    for (let i = 0; i < ordered.length - 1; i++) {
      const rf = ordered[i]!
      curMass -= rf.usableMass
      curMoment -= rf.usableMass * rf.resolvedArm

      // Invariant: with ZFM>0 and ordered tanks subset of takeoff fuel, curMass stays >0 after each partial burn.
      /* v8 ignore else -- @preserve */
      if (curMass > 0) {
        burnSequenceWaypoints.push({
          arm: curMoment / curMass,
          mass: curMass,
          label: `${seqName} #${i + 1}`,
        })
      }
    }
  }

  const migrationPath: MigrationPoint[] = []
  migrationPath.push({ ...takeoffCenterOfGravityPoint, label: 'Takeoff' })
  for (const wp of burnSequenceWaypoints) migrationPath.push(wp)
  migrationPath.push({ ...landingCenterOfGravityPoint, label: 'Landing' })

  // @IMP-MB-CORE-008@ (FROM: @REQ-MB-006@, @REQ-MB-004@, @REQ-MB-011@)
  const takeoffX = input.graphType === 'arm' ? takeoffCenterOfGravityPoint.arm : takeoffMoment
  const takeoffInside = isCgWithinEnvelope(
    takeoffX,
    takeoffCenterOfGravityPoint.mass,
    input.envelope,
  )

  if (!takeoffInside) {
    violations.push({ type: 'CG_OUT_OF_ENVELOPE' })
  } else {
    // @IMP-MB-CORE-010@ (FROM: @REQ-MB-011@, @REQ-FE-004@)
    // Check each segment of the migration path against the envelope.
    // A violation occurs when any waypoint is outside the envelope OR when
    // the line segment connecting two consecutive waypoints crosses the
    // envelope boundary — this catches paths that exit and re-enter the
    // envelope between discrete check-points (e.g. burn-down curves).
    let migrationViolation = false

    const allWaypoints = [...burnSequenceWaypoints, landingCenterOfGravityPoint]
    let prevX = takeoffX
    let prevMass = takeoffCenterOfGravityPoint.mass

    for (const wp of allWaypoints) {
      const wpX = input.graphType === 'arm' ? wp.arm : wp.arm * wp.mass

      if (!isCgWithinEnvelope(wpX, wp.mass, input.envelope)) {
        migrationViolation = true
        break
      }

      if (doesSegmentCrossEnvelope(prevX, prevMass, wpX, wp.mass, input.envelope)) {
        migrationViolation = true
        break
      }

      prevX = wpX
      prevMass = wp.mass
    }

    if (migrationViolation) {
      violations.push({ type: 'CG_MIGRATION_EXCEEDED' })
    }
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
