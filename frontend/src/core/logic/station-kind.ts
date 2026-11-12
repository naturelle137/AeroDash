import type { LoadPointDefinition, StationKind } from '../domain/aircraft.types'

// A fuel tank is always a fuel station regardless of the stored kind; an
// unclassified non-fuel station is treated as an occupant so the zero-mass
// plausibility warning errs on the side of firing.
export function resolveStationKind(lp: Pick<LoadPointDefinition, 'kind' | 'fuelTank'>): StationKind {
  if (lp.fuelTank !== null) return 'fuel'
  return lp.kind === 'baggage' ? 'baggage' : 'occupant'
}

export function requiresOccupancy(
  lp: Pick<LoadPointDefinition, 'kind' | 'fuelTank' | 'occupancy'>,
): boolean {
  return resolveStationKind(lp) === 'occupant' && lp.occupancy !== 'optional'
}
