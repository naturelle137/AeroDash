import type { EnvelopePoint } from '@/core/domain/aircraft.types'
import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import { tripPathWithinEnvelope } from '@/core/logic/trip-envelope'
import { interpolateMomentStrict } from '@/core/logic/mb.arm-lookup'
import { normalizeArmToM, parseSourceUnit } from '@/core/logic/unit-normalization'
import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'
import { arrivalCgForPlanning, normalizedLookup } from './arrival-cg'
import { usableFuelForPlanning } from './usable-fuel'

export function assessTripEnvelope(
  aircraft: unknown, category: string | null, stations: readonly StationInput[], mb: MathCoreResult | null,
  tripFuelKg: number, sequence: string, envelope: EnvelopePoint[], graphType: 'arm' | 'moment' | undefined,
): string {
  const unavailable = (reason: string) => `Unavailable: ${reason}`
  const fuel = usableFuelForPlanning(aircraft, category, stations)
  if (!fuel.ok) return unavailable(fuel.reason)
  const profile = AircraftContextSchema.safeParse(aircraft)
  if (!profile.success || !mb || !graphType) return unavailable('Valid current aircraft, M&B and envelope are required.')
  const arrival = arrivalCgForPlanning(aircraft, category, stations, mb, tripFuelKg, sequence)
  if (!arrival.ok) return unavailable(arrival.reason)
  if (Math.abs(mb.takeoffCenterOfGravityPoint.mass - mb.zeroFuelCenterOfGravityPoint.mass - fuel.usableFuelKg) > 1e-6)
    return unavailable('Current M&B and fuel inventory must match.')
  const tanks = fuel.tanks.map(tank => ({ ...tank, geometry: profile.data.loadPoints[tank.index]! }))
  if (tanks.length > 1) tanks.sort((a, b) =>
    a.geometry.fuelTank!.burnSequences.find(entry => entry.sequenceName === sequence)!.ordinalPosition -
    b.geometry.fuelTank!.burnSequences.find(entry => entry.sequenceName === sequence)!.ordinalPosition)
  const armUnit = parseSourceUnit(profile.data.sourceUnit).armUnit
  const path = [{ mass: mb.takeoffCenterOfGravityPoint.mass, moment: mb.takeoffCenterOfGravityPoint.moment }]
  let remaining = tripFuelKg
  for (const tank of tanks) {
    const burned = Math.min(remaining, tank.usableFuelKg)
    if (tank.geometry.armLookup.length) {
      const lookup = normalizedLookup(profile.data, tank.geometry)
      if (typeof lookup === 'string') return unavailable(lookup)
      const start = tank.unusableFuelKg + tank.usableFuelKg
      const end = start - burned
      const quantities = lookup.map(point => point.massOrVolume).filter(q => q < start && q > end).reverse()
      quantities.push(end)
      let previousQuantity = start
      for (const quantity of quantities) {
        const before = interpolateMomentStrict(previousQuantity, lookup)
        const after = interpolateMomentStrict(quantity, lookup)
        if (before === null || after === null) return unavailable('Lookup table does not cover the tank load.')
        const previous = path[path.length - 1]!
        path.push({ mass: previous.mass - (previousQuantity - quantity), moment: previous.moment - (before - after) })
        previousQuantity = quantity
      }
    } else {
      const previous = path[path.length - 1]!
      path.push({ mass: previous.mass - burned, moment: previous.moment - burned * normalizeArmToM(tank.geometry.arm!, armUnit) })
    }
    remaining -= burned
  }
  const result = tripPathWithinEnvelope(path, envelope, graphType)
  return result === null ? unavailable('A valid envelope and finite path are required.') : result ? 'Inside envelope' : 'Outside envelope'
}
