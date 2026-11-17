import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import type { MassBalanceState } from '@/modules/mass-balance/stores/mass-balance.types'
import type { MassSource } from './poh-inspection'

export type FlightPrepMassInput = {
  hasAircraft: boolean
  uiState: MassBalanceState
  lastResult: MathCoreResult | null
  hasErrorNotification: boolean
  electric: boolean
  /** Current trip arrival from Fuel & Endurance; null when unconfigured. */
  arrival: { ok: true; arrivalMassKg: number } | { ok: false; reason: string } | null
  /** Fuel planning reason when no arrival exists. */
  fuelReason: string | null
}

/**
 * Takeoff uses the current valid Mass & Balance takeoff mass; landing uses only
 * the current trip-arrival mass. The fuel-burn endpoint (all usable fuel burned)
 * is never a landing mass, and an invalid takeoff mass invalidates the arrival.
 */
export function flightPrepMassSources(input: FlightPrepMassInput): { takeoff: MassSource; landing: MassSource } {
  const takeoff = takeoffSource(input)
  if (takeoff.status === 'unavailable') {
    return { takeoff, landing: { status: 'unavailable', reason: `No trip-arrival mass without a valid takeoff mass. ${takeoff.reason}` } }
  }
  return { takeoff, landing: landingSource(input) }
}

function takeoffSource(input: FlightPrepMassInput): MassSource {
  const unavailable = (reason: string): MassSource => ({ status: 'unavailable', reason })
  if (!input.hasAircraft) return unavailable('Select an aircraft in section 01.')
  if (input.uiState === 'UNCONFIGURED') return unavailable('Complete every required Mass & Balance station in section 02.')
  if (input.uiState === 'ERROR_CRITICAL' || input.hasErrorNotification) {
    return unavailable('Mass & Balance has an error or limit violation. Resolve it in section 02.')
  }
  const result = input.lastResult
  if ((input.uiState !== 'VERIFIED_SAFE' && input.uiState !== 'WARNING') || !result?.success) {
    return unavailable('No valid current Mass & Balance result. Complete section 02.')
  }
  if (result.violations.some((violation) => violation.type === 'STATION_LIMIT_EXCEEDED')) {
    return unavailable('A station limit is exceeded. Correct the loading in section 02.')
  }
  const mass = result.takeoffCenterOfGravityPoint.mass
  if (!Number.isFinite(mass) || mass <= 0) return unavailable('Mass & Balance takeoff mass is not a finite positive value.')
  return { status: 'ready', massKg: mass, origin: 'current Mass & Balance takeoff mass' }
}

function landingSource(input: FlightPrepMassInput): MassSource {
  if (input.electric) {
    return { status: 'unavailable', reason: 'Trip-arrival mass is unsupported for electric aircraft, so landing distances are unavailable.' }
  }
  const arrival = input.arrival
  if (!arrival) {
    return { status: 'unavailable', reason: `No trip-arrival mass. ${input.fuelReason ?? 'Enter the trip in Fuel & Endurance (section 03).'} The all-usable-fuel-burned endpoint is not used for landing.` }
  }
  if (!arrival.ok) return { status: 'unavailable', reason: `Trip-arrival mass is invalid: ${arrival.reason}` }
  if (!Number.isFinite(arrival.arrivalMassKg) || arrival.arrivalMassKg <= 0) {
    return { status: 'unavailable', reason: 'Trip-arrival mass is not a finite positive value.' }
  }
  return { status: 'ready', massKg: arrival.arrivalMassKg, origin: 'current trip-arrival mass (takeoff mass minus trip fuel)' }
}
