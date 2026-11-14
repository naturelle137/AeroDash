import { computed, ref, watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { arrivalCgForPlanning, arrivalSequenceChoices } from './arrival-cg'
import { usableFuelForPlanning } from './usable-fuel'
import { calculateTripArrival } from '@/core/logic/trip-arrival'
import { calculateFuelEndurance } from '@/core/logic/fuel-endurance'

export function useFuelPlanning() {
const store = useMassBalanceStore()
const sequence = ref('')
const sequences = computed(() => arrivalSequenceChoices(store.aircraft, store.activeCategory))
watch(
  () => [store.aircraft, store.activeCategory],
  () => {
    sequence.value = ''
  },
  { deep: true, flush: 'sync' },
)
const method = ref('')
const directTripFuel = ref('')
const consumption = ref('')
const trip = ref('')
const reserve = ref('')
watch(
  () => store.aircraft?.id,
  () => {
    method.value = ''
    directTripFuel.value = ''
    consumption.value = ''
    trip.value = ''
    reserve.value = ''
  },
  { flush: 'sync' },
)
watch(
  method,
  () => {
    sequence.value = ''
    directTripFuel.value = ''
    consumption.value = ''
    trip.value = ''
    reserve.value = ''
  },
  { flush: 'sync' },
)
const fuel = computed(() =>
  usableFuelForPlanning(store.aircraft, store.activeCategory, store.stations),
)
function decimal(raw: string): number {
  return /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN
}
const result = computed(() =>
  method.value === 'duration' && fuel.value.ok
    ? calculateFuelEndurance({
        usableFuelKg: fuel.value.usableFuelKg,
        consumptionKgPerHour: decimal(consumption.value),
        tripMinutes: decimal(trip.value),
        reserveMinutes: decimal(reserve.value),
      })
    : null,
)
const plan = computed(() => (result.value?.ok ? result.value.plan : null))
const arrival = computed(() => {
  if (!fuel.value.ok || !method.value) return null
  const tripFuelKg =
    method.value === 'direct' ? decimal(directTripFuel.value) : plan.value?.tripFuelKg
  if (tripFuelKg === undefined) return null
  if (!Number.isFinite(tripFuelKg) || tripFuelKg < 0) {
    return {
      ok: false as const,
      reason: 'Enter explicit finite nonnegative Trip Fuel in kg. Blank fields are unconfigured.',
    }
  }
  const mb = store.lastResult
  if (
    !mb?.success ||
    store.hasErrorNotification ||
    mb.violations.some((v) => v.type === 'STATION_LIMIT_EXCEEDED')
  ) {
    return { ok: false as const, reason: 'Valid current Mass & Balance loading is required.' }
  }
  const result = calculateTripArrival({
    takeoffMassKg: mb.takeoffCenterOfGravityPoint.mass,
    usableFuelKg: fuel.value.usableFuelKg,
    tripFuelKg,
  })
  if (result.ok) return result
  return {
    ok: false as const,
    reason:
      result.reason === 'TRIP_EXCEEDS_USABLE_FUEL'
        ? 'Trip fuel exceeds available usable fuel; reduce the trip or correct the tank loads.'
        : 'Mass & Balance and fuel inventory must contain finite, consistent masses.',
  }
})
const arrivalCg = computed(() => {
  if (!arrival.value?.ok) return null
  return arrivalCgForPlanning(
    store.aircraft,
    store.activeCategory,
    store.stations,
    store.lastResult,
    arrival.value.tripFuelKg,
    sequence.value,
  )
})
const format = (value: number) =>
  value > 0 && value < 0.001
    ? '<0.001'
    : value.toLocaleString('en-GB', { maximumFractionDigits: 3 })

const presentation = computed<FuelPresentation>(() => {
  const inputKey = JSON.stringify([method.value, directTripFuel.value, consumption.value, trip.value, reserve.value, sequence.value])
  const reason = !fuel.value.ok ? fuel.value.reason
    : !method.value ? 'Choose a planning method to configure the plan.'
    : arrival.value && !arrival.value.ok ? arrival.value.reason
    : !arrival.value?.ok ? 'Enter finite positive consumption and explicit nonnegative trip and reserve durations. Blank fields are unconfigured.' : null
  const rows: FuelPresentation['rows'][number][] = []
  const warnings: string[] = []
  const row = (label: string, value: number, unit: string) => rows.push({ label, value: `${format(value)} ${unit}` })
  if (fuel.value.ok) {
    row('Usable fuel', fuel.value.usableFuelKg, 'kg')
    row('Excluded unusable fuel', fuel.value.excludedUnusableKg, 'kg')
  }
  if (plan.value) {
    row('Planned average consumption', decimal(consumption.value), 'kg/h')
    row('Planned flight duration', decimal(trip.value), 'min')
    row('Reserve duration', decimal(reserve.value), 'min')
    row('Total endurance', plan.value.enduranceMinutes, 'min')
    row('Trip fuel', plan.value.tripFuelKg, 'kg')
    row('Required reserve fuel', plan.value.reserveFuelKg, 'kg')
    row('Trip + reserve fuel', plan.value.requiredFuelKg, 'kg')
    row(plan.value.marginKg < 0 ? 'Fuel shortfall' : 'Remaining after trip + reserve', Math.abs(plan.value.marginKg), 'kg')
    if (plan.value.warning) warnings.push('WARN-FE-001 — Insufficient fuel for the entered trip plus reserve.')
    if (plan.value.reserveShortfall) warnings.push('Usable fuel is insufficient even for the reserve alone.')
    if (plan.value.marginKg === 0) warnings.push('Zero margin: exactly the entered arithmetic budget.')
  }
  if (arrival.value?.ok) {
    row('Takeoff mass', arrival.value.takeoffMassKg, 'kg')
    row('Trip fuel burned', arrival.value.tripFuelKg, 'kg')
    row('Estimated arrival mass', arrival.value.arrivalMassKg, 'kg')
    row('Usable fuel remaining on arrival', arrival.value.remainingFuelKg, 'kg')
  }
  if (arrivalCg.value?.ok) row('Estimated arrival CG', arrivalCg.value.arrivalCgM, 'm')
  return { inputKey, reason, method: method.value, sequence: sequence.value, rows, warnings,
    cgReason: arrivalCg.value && !arrivalCg.value.ok ? arrivalCg.value.reason : null }
})
return { method, directTripFuel, consumption, trip, reserve, sequence, sequences, fuel, result, plan, arrival, arrivalCg, format, presentation }
}
export type FuelPlanning = ReturnType<typeof useFuelPlanning>
export interface FuelPresentation {
  readonly inputKey: string
  readonly reason: string | null
  readonly method: string
  readonly sequence: string
  readonly rows: readonly { readonly label: string; readonly value: string }[]
  readonly warnings: readonly string[]
  readonly cgReason: string | null
}
