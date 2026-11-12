import type { LoadPointDefinition, StationKind } from '../domain/aircraft.types'

// @IMP-AD-CORE-024@ (FROM: @REQ-UQ-006@)
// A fuel tank is always a fuel station regardless of the stored kind; an
// unclassified non-fuel station is treated as an occupant so the zero-mass
// plausibility warning errs on the side of firing.
export function resolveStationKind(lp: Pick<LoadPointDefinition, 'kind' | 'fuelTank'>): StationKind {
  if (lp.fuelTank !== null) return 'fuel'
  return lp.kind === 'baggage' ? 'baggage' : 'occupant'
}

// @IMP-AD-CORE-026@ (FROM: @REQ-UQ-006@)
export function requiresOccupancy(
  lp: Pick<LoadPointDefinition, 'kind' | 'fuelTank' | 'occupancy'>,
): boolean {
  return resolveStationKind(lp) === 'occupant' && lp.occupancy !== 'optional'
}
