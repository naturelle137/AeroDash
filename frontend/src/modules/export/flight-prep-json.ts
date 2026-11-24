import type { FlightPrepDraft } from '@/core/domain/flightprep-draft.schema'
import type { ManualRunway, ManualRunwayDraft, ManualRunwayRecord } from '@/core/logic/manual-runway'
import { daysToDeclaredEffect, daysToDeclaredExpiry, runwayFreshness } from '@/core/logic/manual-runway'

type Entries = Pick<FlightPrepDraft, 'fuel' | 'performance'>
export type FlightPrepExport = {
  aircraft: { id: string; registration: string; manufacturer: string; model: string } | null
  massBalance: { category: string | null; stations: { name: string; unit: string; weight: number | null; touched: boolean }[] }
  entries: Entries
  electric: { available: string; power: string; minutes: string } | null
  manualConfiguration: string
  runway: { draft: ManualRunwayDraft; saved: ManualRunwayRecord | null; weatherSurface: ManualRunwayRecord['weatherSurface'] | null; assessmentDate: string; deviceDate: string; automaticDate: boolean }
  wind: { runwayHeading: string; windDirection: string; windSpeed: string; unit: string; gustSpeed: string }
  weatherSources: Partial<Record<'wind' | 'temperature' | 'qnh', { source: string; value: string }>>
}

export const flightPrepUnits = { temperature: '°C', pressureAltitudeDirect: 'ft', fuelMass: 'kg', consumption: 'kg/h', duration: 'min', correctionHeadwind: 'kt', correctionSlope: '%', electricEnergy: 'kWh', electricPower: 'kW', electricDuration: 'min', runwayHeading: 'degrees', windDirection: 'degrees' } as const

function dateIntervals(runway: Pick<ManualRunway, 'effectiveDate' | 'expiryDate'> | null, date: string) {
  if (!runway || (runway.effectiveDate && runway.expiryDate && runway.effectiveDate > runway.expiryDate)) return { effect: null, expiry: null }
  const effect = daysToDeclaredEffect(runway, date)
  const expiry = daysToDeclaredExpiry(runway, date)
  if ((runway.effectiveDate && effect === null) || (runway.expiryDate && expiry === null)) return { effect: null, expiry: null }
  return { effect, expiry }
}

export function buildFlightPrepJson(data: FlightPrepExport, now: Date): string {
  return JSON.stringify({
    format: 'aerodash-flight-preparation', version: 1, exportedAt: now.toISOString(),
    notice: 'Unverified preparation data; verify all values against authoritative sources. Not an approval or fitness-for-flight assessment.',
    units: flightPrepUnits,
    ...data,
    runway: {
      ...data.runway,
      dateCheck: {
        selected: data.runway.saved ? runwayFreshness(data.runway.saved.runway, data.runway.assessmentDate) : 'unknown',
        device: data.runway.saved ? runwayFreshness(data.runway.saved.runway, data.runway.deviceDate) : 'unknown',
        draft: {
          selected: runwayFreshness(data.runway.draft, data.runway.assessmentDate),
          device: runwayFreshness(data.runway.draft, data.runway.deviceDate),
        },
        intervals: {
          selected: dateIntervals(data.runway.saved?.runway ?? null, data.runway.assessmentDate),
          device: dateIntervals(data.runway.saved?.runway ?? null, data.runway.deviceDate),
          draft: {
            selected: dateIntervals(data.runway.draft, data.runway.assessmentDate),
            device: dateIntervals(data.runway.draft, data.runway.deviceDate),
          },
        },
        notice: 'Pilot-declared dates only; source currency is unverified and NOTAM/SUP coverage is unknown.',
      },
    },
  }, null, 2)
}

export function downloadFlightPrepJson(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'aerodash-flight-preparation.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
