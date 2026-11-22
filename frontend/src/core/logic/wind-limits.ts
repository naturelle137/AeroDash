import type { AircraftProfileWindLimit } from '../adapters/aircraft.schema'
import { computeWindComponents, type WindComponentInput } from './wind-components'

export function compareWindLimits(input: WindComponentInput, limits?: AircraftProfileWindLimit[]) {
  const steady = compare(input, limits, 'manual wind')
  const gust = computeWindComponents(input).status === 'valid' ? input.gustSpeed?.trim() : undefined
  return gust ? [...steady, ...compare({ ...input, windSpeed: gust }, limits, 'manual gust')] : steady
}

function compare(input: WindComponentInput, limits: AircraftProfileWindLimit[] | undefined, provenance: string) {
  const result = computeWindComponents(input)
  if (result.status !== 'valid' || !limits) return []
  const speed = Number(input.windSpeed.replace(',', '.'))
  const angle = speed === 0 ? 0 : (Number(input.windDirection.replace(',', '.')) - Number(input.runwayHeading.replace(',', '.'))) * Math.PI / 180
  const knots = result.unit === 'kt' ? 1 : result.unit === 'km/h' ? 1 / 1.852 : 3600 / 1852
  const values = { MaxTotalWind: speed * knots, MaxTailwind: Math.max(0, -speed * Math.cos(angle) * knots), MaxCrosswind: Math.abs(speed * Math.sin(angle) * knots) }
  const labels = { MaxTotalWind: 'Total wind', MaxTailwind: 'Tailwind', MaxCrosswind: 'Crosswind' }
  return limits.flatMap(limit => {
    if (!(limit.component in values) || !Number.isFinite(limit.value) || limit.value < 0 || !['Limit', 'Demonstrated'].includes(limit.classification)) return []
    const component = limit.component as keyof typeof values
    if (values[component] <= limit.value + 1e-10) return []
    const severity = limit.classification === 'Limit' ? 'CRITICAL' : 'WARNING'
    return [{ id: severity === 'CRITICAL' ? 'CRIT-WX-001' : 'WARN-WX-001', severity, message: `${labels[component]} exceeds ${limit.classification} ${limit.value} kt (${provenance}).` }]
  })
}
