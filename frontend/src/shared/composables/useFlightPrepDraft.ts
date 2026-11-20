import { watch } from 'vue'
import type { FlightPrepDraft } from '@/core/domain/flightprep-draft.schema'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import type { FuelPlanning } from '@/modules/fuel-endurance/services/use-fuel-planning'
import type { PerformanceStep } from '@/modules/performance/composables/performance-step'
import { emptyCorrectionInputs, defaultSafetyFactors } from '@/modules/performance/services/corrected-distances'
import { emptyObstacleInput } from '@/modules/performance/services/obstacle-constraint'
import { OPERATIONS } from '@/core/logic/performance.correction-sources'
import { useFlightPrepDraftStore } from '@/stores/flightprep-draft.store'

type Fields = Pick<FlightPrepDraft, 'fuel' | 'performance'>

function collect(fuel: FuelPlanning, step: PerformanceStep): Fields {
  const { pa } = step
  return {
    fuel: {
      method: fuel.method.value as Fields['fuel']['method'],
      sequence: fuel.sequence.value,
      directTripFuel: fuel.directTripFuel.value,
      consumption: fuel.consumption.value,
      trip: fuel.trip.value,
      reserve: fuel.reserve.value,
    },
    performance: {
      temperature: step.temperature.value,
      pressureAltitude: {
        method: pa.method.value,
        direct: pa.direct.value,
        qnh: pa.draft.qnh,
        qnhUnit: pa.draft.qnhUnit as 'hPa',
        elevation: pa.draft.elevation,
        elevationUnit: pa.draft.elevationUnit as 'm' | 'ft',
      },
      corrections: {
        takeoff: { ...step.corrections.takeoff },
        landing: { ...step.corrections.landing },
      },
      safetyFactors: {
        takeoff: { ...step.safetyFactors.takeoff },
        landing: { ...step.safetyFactors.landing },
      },
      obstacle: { ...step.obstacle },
    },
  }
}

/** True when the pilot has entered nothing; units alone are preferences, not input. */
function isBlank(f: Fields): boolean {
  const { fuel, performance: p } = f
  const blank = (...values: string[]) => values.every((v) => v === '')
  return blank(fuel.method, fuel.sequence, fuel.directTripFuel, fuel.consumption, fuel.trip, fuel.reserve,
      p.temperature, p.pressureAltitude.method, p.pressureAltitude.direct, p.pressureAltitude.qnh, p.pressureAltitude.elevation,
      p.obstacle.height, p.obstacle.distance)
    && OPERATIONS.every((op) => blank(p.corrections[op].headwind, p.corrections[op].slope, p.safetyFactors[op].custom)
      && p.safetyFactors[op].preset === 'poh-afm')
}

/**
 * Autosaves the fuel and performance inputs per aircraft and restores them when
 * that aircraft is loaded. Restored text goes back through the ordinary input
 * validation; acknowledgements are never stored, and any restore changes the
 * inputs, which already invalidates a prior acknowledgement.
 */
export function useFlightPrepDraft(fuel: FuelPlanning, step: PerformanceStep) {
  const mb = useMassBalanceStore()
  const drafts = useFlightPrepDraftStore()

  function current(): FlightPrepDraft | null {
    // Never called with demo inputs: nothing is scheduled while a demo runs and starting one flushes first.
    if (!mb.aircraft) return null
    const fields = collect(fuel, step)
    return isBlank(fields) ? null : { aircraftId: mb.aircraft.id, savedAt: new Date().toISOString(), ...fields }
  }

  function apply(draft: FlightPrepDraft): void {
    const { fuel: f, performance: p } = draft
    // Method first: changing it clears the dependent fuel fields.
    fuel.method.value = f.method
    fuel.sequence.value = fuel.sequences.value.includes(f.sequence) ? f.sequence : ''
    fuel.directTripFuel.value = f.directTripFuel
    fuel.consumption.value = f.consumption
    fuel.trip.value = f.trip
    fuel.reserve.value = f.reserve
    const { pa } = step
    step.temperature.value = p.temperature
    pa.method.value = p.pressureAltitude.method
    pa.direct.value = p.pressureAltitude.direct
    pa.draft.qnhUnit = p.pressureAltitude.qnhUnit
    pa.draft.qnh = p.pressureAltitude.qnh
    // Unit before text: a unit change converts the existing text.
    pa.draft.elevationUnit = p.pressureAltitude.elevationUnit
    pa.draft.elevation = p.pressureAltitude.elevation
    for (const op of OPERATIONS) {
      Object.assign(step.corrections[op], p.corrections[op])
      Object.assign(step.safetyFactors[op], p.safetyFactors[op])
    }
    Object.assign(step.obstacle, p.obstacle)
  }

  /** Reset every covered input to its empty default. */
  function reset(): void {
    apply({
      aircraftId: '', savedAt: '',
      fuel: { method: '', sequence: '', directTripFuel: '', consumption: '', trip: '', reserve: '' },
      performance: {
        temperature: '',
        pressureAltitude: { method: '', direct: '', qnh: '', qnhUnit: 'hPa', elevation: '', elevationUnit: step.pa.draft.elevationUnit as 'm' | 'ft' },
        corrections: emptyCorrectionInputs(),
        safetyFactors: defaultSafetyFactors(),
        obstacle: emptyObstacleInput(),
      },
    })
  }

  // After the loading code (profile, category, restored M&B session) has settled this tick.
  watch(() => mb.aircraft?.id, (id) => {
    drafts.cancelPendingSave()
    drafts.restored = null
    if (!id) return
    const draft = drafts.load(id)
    // Without a stored draft the previous aircraft's entries must not carry over.
    if (!draft) {
      reset()
      return
    }
    apply(draft)
    drafts.restored = { aircraftId: id, savedAt: draft.savedAt }
  }, { flush: 'post', immediate: true })

  // Keep what was typed before the demo copy replaces the inputs; nothing is scheduled while it runs.
  watch(() => mb.isDemoActive, (active) => { if (active) drafts.flushPendingSave() }, { flush: 'sync' })

  watch(() => JSON.stringify([mb.aircraft?.id, collect(fuel, step)]), () => {
    const id = mb.aircraft?.id
    if (id && !mb.isDemoActive) drafts.scheduleSave(id, current)
  })

  /** Confirmed destructive clear: stored draft and the inputs it filled. */
  function clearDraft(): void {
    if (mb.aircraft) drafts.clear(mb.aircraft.id)
    drafts.restored = null
    reset()
  }

  return { clearDraft }
}
