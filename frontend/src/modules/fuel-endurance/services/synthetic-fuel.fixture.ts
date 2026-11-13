import { AIRCRAFT_CATALOGUE } from '@/modules/mass-balance/data/aircraft-catalogue'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

// Synthetic software fixture, not operational aircraft data.
export function syntheticFuelContext() {
  const aircraft = structuredClone(AIRCRAFT_CATALOGUE[0]!)
  aircraft.loadPoints = [
    {
      name: 'Synthetic tank',
      arm: 1,
      armLookup: [],
      operationalLimit: 100,
      defaultQuantity: 50,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    },
  ]
  return aircraft
}
export const stations: StationInput[] = [
  {
    index: 0,
    name: 'Synthetic tank',
    weight: 50,
    touched: true,
    verified: false,
    mandatory: false,
    hasError: false,
  },
]
