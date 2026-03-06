import type { MathCoreInput, MathCoreResult, Violation } from './mass-balance.math-types'
import type { CgPoint, MigrationPoint } from './mass-balance.math-types'
import type { ArmLookupEntry } from '../aircraft/aircraft.types'

type NumericRule = { min?: number; required?: boolean }

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
export function calculateMassBalance(input: MathCoreInput): MathCoreResult {
  const violations: Violation[] = []
  const validationErrors = validateInput(input)
  if (validationErrors.length > 0)
    return {
      success: false,
      violations: validationErrors,
      takeoffMass: NaN,
      zeroFuelMass: NaN,
      landingMass: NaN,
      centerOfGravityPosition: NaN,
      takeoffCenterOfGravity: { arm: NaN, mass: NaN },
      landingCenterOfGravity: { arm: NaN, mass: NaN },
      migrationPath: [],
    }

  // Zero Fuel Mass = Basic Empty Mass + sum(masses of non-fuel stations)
  let zeroFuelMass = input.basicEmptyMass
  let zeroFuelMoment = input.basicEmptyMass * input.emptyCenterOfGravity

  for (const s of input.stations) {
    const isFuel = input.fuelStations.some((fs) => fs.index === s.index)
    if (!isFuel) {
      let arm: number

      try {
        arm = s.armLookup ? lookupArm(s.mass, s.armLookup) : (s.arm ?? 0)
      } catch {
        /* v8 ignore start - Fail Safe: This case is unreachable because the input is validated before this function is called. */
        violations.push({
          type: 'INVALID_INPUT',
          severity: 'CRITICAL',
          field: 'LOOKUP_ARM',
        })
        return {
          success: false,
          violations: violations,
          takeoffMass: NaN,
          zeroFuelMass: NaN,
          landingMass: NaN,
          centerOfGravityPosition: NaN,
          takeoffCenterOfGravity: { arm: NaN, mass: NaN },
          landingCenterOfGravity: { arm: NaN, mass: NaN },
          migrationPath: [],
        }
      }
      /* v8 ignore stop */
      zeroFuelMass += s.mass
      zeroFuelMoment += s.mass * (arm ?? 0)
    }
  }

  // @IMP-MB-CORE-001@ (FROM: @REQ-MB-009@)
  if (input.maxZeroFuelMass !== null && zeroFuelMass > input.maxZeroFuelMass) {
    violations.push({
      type: 'MZFM_EXCEEDED',
      severity: 'CRITICAL',
    })
  }

  // @IMP-MB-CORE-002@ (FROM: @REQ-MB-008@)
  // Takeoff Mass = Zero Fuel Mass + sum(masses of fuel stations)
  let takeoffMass = zeroFuelMass
  let takeoffMoment = zeroFuelMoment

  for (const fs of input.fuelStations) {
    let arm: number

    try {
      arm = fs.armLookup ? lookupArm(fs.mass, fs.armLookup) : (fs.arm ?? 0)
    } catch {
      /* v8 ignore start - Fail Safe: This case is unreachable because the input is validated before this function is called. */
      violations.push({
        type: 'INVALID_INPUT',
        severity: 'CRITICAL',
        field: 'LOOKUP_ARM',
      })
      return {
        success: false,
        violations: violations,
        takeoffMass: NaN,
        zeroFuelMass: NaN,
        landingMass: NaN,
        centerOfGravityPosition: NaN,
        takeoffCenterOfGravity: { arm: NaN, mass: NaN },
        landingCenterOfGravity: { arm: NaN, mass: NaN },
        migrationPath: [],
      }
      /* v8 ignore stop */
    }
    takeoffMass += fs.mass
    takeoffMoment += fs.mass * (arm ?? 0)
  }

  // @IMP-MB-CORE-003@ (FROM: @REQ-MB-005@)
  if (takeoffMass > input.maxTakeoffMass) {
    violations.push({
      type: 'MTOM_EXCEEDED',
      severity: 'CRITICAL',
    })
  }

  // @IMP-MB-CORE-004@ (FROM: @REQ-MB-008@)
  // Landing Mass = Takeoff Mass - sum(usable fuel)
  // For now, we assume all fuel is burned except unusable.
  // TODO: In a more complex version, the user might input planned fuel burn.
  // For the current MVP logic, we migration from TOM to ZFM + unusable fuel.
  let landingMass = zeroFuelMass
  let landingMoment = zeroFuelMoment

  for (const fs of input.fuelStations) {
    const unusableMass = fs.unusableFuel // Assuming unusableFuel is already in mass units for this calculation
    let arm: number

    try {
      arm = fs.armLookup ? lookupArm(unusableMass, fs.armLookup) : (fs.arm ?? 0)
    } catch {
      /* v8 ignore start - Fail Safe: This case is unreachable because the input is validated before this function is called. */
      violations.push({
        type: 'INVALID_INPUT',
        severity: 'CRITICAL',
        field: 'LOOKUP_ARM',
      })
      return {
        success: false,
        violations: violations,
        takeoffMass: NaN,
        zeroFuelMass: NaN,
        landingMass: NaN,
        centerOfGravityPosition: NaN,
        takeoffCenterOfGravity: { arm: NaN, mass: NaN },
        landingCenterOfGravity: { arm: NaN, mass: NaN },
        migrationPath: [],
      }
      /* v8 ignore stop */
    }
    landingMass += unusableMass
    landingMoment += unusableMass * (arm ?? 0)
  }

  // @IMP-MB-CORE-005@ (FROM: @REQ-MB-008@)
  const takeoffCenterOfGravity: CgPoint = {
    mass: takeoffMass,
    arm: takeoffMass > 0 ? takeoffMoment / takeoffMass : 0,
  }

  // @IMP-MB-CORE-006@ (FROM: @REQ-MB-008@)
  const landingCenterOfGravity: CgPoint = {
    mass: landingMass,
    arm: landingMass > 0 ? landingMoment / landingMass : 0,
  }

  // @IMP-MB-CORE-007@ (FROM: @REQ-MB-008@)
  const migrationPath: MigrationPoint[] = []

  migrationPath.push({ ...takeoffCenterOfGravity, label: 'Takeoff' })

  // If there are multiple fuel tanks with burn sequences, we would calculate intermediate points here.
  // For the MVP, we just do a straight line Takeoff -> Landing.
  migrationPath.push({ ...landingCenterOfGravity, label: 'Landing' })

  // @IMP-MB-CORE-008@ (FROM: @REQ-MB-006@)
  const envelopeVertices = input.envelope.map((p) => ({ x: p.armOrMoment, y: p.mass }))

  // @IMP-MB-CORE-009@ (FROM: @REQ-MB-004@, @REQ-MB-011@)
  const takeoffX = input.graphType === 'arm' ? takeoffCenterOfGravity.arm : takeoffMoment
  if (!isPointInPolygon(takeoffX, takeoffCenterOfGravity.mass, envelopeVertices)) {
    violations.push({
      type: 'CG_OUT_OF_ENVELOPE',
      severity: 'CRITICAL',
    })
  }

  // @IMP-MB-CORE-010@ (FROM: @REQ-MB-011@)
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
    success: true,
  }
}

// @IMP-MB-CORE-011@ (FROM: @REQ-MB-007@)
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

// @IMP-MB-CORE-012@ (FROM: @REQ-MB-012@)
/**
 * Linear interpolation for arm lookup tables.
 * Arm = Moment / Mass (or Volume).
 */
function lookupArm(mass: number, lookup: ArmLookupEntry[]): number {
  if (lookup.length === 0) return 0
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

  /* v8 ignore start - This case is unreachable because the input is validated before this function is called. */
  throw new Error('Unreachable Code: Mass could not be assigned to an arm interval.')
  /* v8 ignore stop */
}

function validateInput(input: MathCoreInput) {
  const validationErrors: Violation[] = []

  validationErrors.push(
    ...validateNumeric(input.maxTakeoffMass, 'MTOM', { min: 0, required: true }),
  )
  validationErrors.push(...validateNumeric(input.basicEmptyMass, 'BEM', { min: 0, required: true }))
  validationErrors.push(
    ...validateNumeric(input.emptyCenterOfGravity, 'EMPTY_CG', { required: true }),
  )
  validationErrors.push(...validateNumeric(input.maxZeroFuelMass, 'MZFM', { min: 0 }))

  input.stations.forEach((s, i) => {
    const isFuelStation = input.fuelStations.some((fs) => fs.index === s.index)

    validationErrors.push(
      ...validateNumeric(s.index, `STATIONS[${i}].INDEX`, { min: 0, required: true }),
    )

    if (!isFuelStation) {
      validationErrors.push(
        ...validateNumeric(s.mass, `STATIONS[${i}].MASS`, { min: 0, required: true }),
      )
    }

    if (s.armLookup === null && !isFuelStation) {
      validationErrors.push(...validateNumeric(s.arm, `STATIONS[${i}].ARM`, { required: true }))
    }
  })

  input.fuelStations.forEach((fs, i) => {
    validationErrors.push(
      ...validateNumeric(fs.index, `FUEL_STATIONS[${i}].INDEX`, { min: 0, required: true }),
    )
    validationErrors.push(
      ...validateNumeric(fs.unusableFuel, `FUEL_STATIONS[${i}].UNUSABLE_FUEL`, {
        min: 0,
        required: true,
      }),
    )
  })

  return validationErrors
}

function validateNumeric(value: unknown, field: string, rules: NumericRule = {}): Violation[] {
  const fieldErrors: Violation[] = []

  // 1. Check: Existenz
  if (value === null || value === undefined) {
    if (rules.required) {
      fieldErrors.push({ type: 'INVALID_INPUT', severity: 'CRITICAL', field, code: 'REQUIRED' })
    }
    return fieldErrors // Wenn null, brauchen wir den Rest nicht prüfen
  }

  // 2. Check: Ist es eine Zahl und kein NaN?
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fieldErrors.push({ type: 'INVALID_INPUT', severity: 'CRITICAL', field, code: 'NOT_A_NUMBER' })
    return fieldErrors
  }

  // 3. Check: Endlichkeit (kein Infinity)
  if (!Number.isFinite(value)) {
    fieldErrors.push({ type: 'INVALID_INPUT', severity: 'CRITICAL', field, code: 'LIMIT_REACHED' })
  }

  // 4. Check: Minimum (z.B. für Gewichte)
  if (rules.min !== undefined && value < rules.min) {
    fieldErrors.push({ type: 'INVALID_INPUT', severity: 'CRITICAL', field, code: 'NEGATIVE_VALUE' })
  }

  return fieldErrors
}
