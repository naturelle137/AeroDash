export function calculateElectricEndurance(capacity: number, floor: number, available: number, power: number) {
  if (![capacity, floor, available, power].every(Number.isFinite) || capacity <= 0 || floor < 0 || floor >= capacity || available < 0 || available > capacity || power <= 0) return null
  const depletion = available / power * 60
  const aboveReserve = Math.max(0, available - floor) / power * 60
  if (![depletion, aboveReserve].every(Number.isFinite)) return null
  return { depletion, aboveReserve }
}

export function calculateElectricEnergy(capacity: number, floor: number, available: number, power: number, minutes: number) {
  if (![capacity, floor, available, power, minutes].every(Number.isFinite) || capacity <= 0 || floor < 0 || floor >= capacity || available < 0 || available > capacity || power <= 0 || minutes < 0) return null
  const trip = power * minutes / 60
  const remaining = available - trip
  const margin = remaining - floor
  if (![trip, remaining, margin].every(Number.isFinite)) return null
  return { trip, remaining, margin }
}

export function calculateElectricAddedReserve(power: number, minutes: number, remaining: number, floor: number) {
  if (![power, minutes, remaining, floor].every(Number.isFinite) || power <= 0 || minutes < 0 || floor < 0) return null
  const reserve = power * minutes / 60
  const afterReserve = remaining - reserve
  const margin = afterReserve - floor
  if (![reserve, afterReserve, margin].every(Number.isFinite)) return null
  return { reserve, afterReserve, margin }
}
