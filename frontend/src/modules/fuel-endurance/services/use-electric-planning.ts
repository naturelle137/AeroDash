import { computed, ref, watch } from 'vue'
import { calculateElectricAddedReserve, calculateElectricEndurance, calculateElectricEnergy } from '@/core/logic/electric-energy'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'

export function useElectricPlanning() {
  const store = useMassBalanceStore()
  const available = ref(''), power = ref(''), minutes = ref(''), reserveMinutes = ref('')
  watch(() => store.aircraft?.id, () => { available.value = ''; power.value = ''; minutes.value = ''; reserveMinutes.value = '' }, { flush: 'sync' })
  const decimal = (raw: string) => /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN
  const presentation = computed(() => {
    const pack = store.aircraft?.batteryPack
    const endurance = pack && calculateElectricEndurance(pack.usableEnergyKwh, pack.reserveFloorKwh, decimal(available.value), decimal(power.value))
    const result = pack && calculateElectricEnergy(pack.usableEnergyKwh, pack.reserveFloorKwh, decimal(available.value), decimal(power.value), decimal(minutes.value))
    const added = result && pack && calculateElectricAddedReserve(decimal(power.value), decimal(reserveMinutes.value), result.remaining, pack.reserveFloorKwh)
    const format = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 3 })
    return {
      inputKey: JSON.stringify([available.value, power.value, minutes.value, reserveMinutes.value, pack]),
      reason: result ? null : 'Enter finite available energy within usable capacity, positive average consumption and nonnegative trip duration; a valid battery profile is required.',
      reserveReason: added ? null : 'Enter an explicit finite nonnegative added reserve duration and valid trip inputs.',
      enduranceReason: endurance ? null : 'Enter finite available energy within usable capacity and positive average consumption; a valid battery profile is required.',
      rows: [
        ...(endurance ? [
          { label: 'Estimated time to depletion', value: `${format(endurance.depletion)} min` },
          { label: 'Estimated time above reserve floor', value: `${format(endurance.aboveReserve)} min` },
        ] : []),
        ...(result && pack ? [
        { label: 'Current available energy', value: `${format(decimal(available.value))} kWh` },
        { label: 'Average consumption', value: `${format(decimal(power.value))} kW` },
        { label: 'Planned trip duration', value: `${format(decimal(minutes.value))} min` },
        { label: 'Reserve floor', value: `${format(pack.reserveFloorKwh)} kWh` },
        { label: 'Estimated trip energy', value: `${format(result.trip)} kWh` },
        { label: 'Estimated remaining energy', value: `${format(result.remaining)} kWh` },
        { label: 'Difference to reserve floor', value: `${format(result.margin)} kWh` },
        ] : []),
        ...(added ? [
          { label: 'Pilot-added reserve duration', value: `${format(decimal(reserveMinutes.value))} min` },
          { label: 'Estimated added reserve energy', value: `${format(added.reserve)} kWh` },
          { label: 'Estimated remaining energy after trip and added reserve', value: `${format(added.afterReserve)} kWh` },
          { label: 'Difference to reserve floor after trip and added reserve', value: `${format(added.margin)} kWh` },
        ] : []),
      ],
      reserveWarning: added && added.margin < 0 ? 'Warning: estimated remaining energy after trip and added reserve is below the reserve floor.' : null,
      warning: result && result.margin < 0 ? 'Warning: estimated remaining energy is below the reserve floor.' : null,
    }
  })
  return { available, power, minutes, reserveMinutes, presentation }
}
export type ElectricPlanning = ReturnType<typeof useElectricPlanning>
export type ElectricPresentation = ElectricPlanning['presentation']['value']
