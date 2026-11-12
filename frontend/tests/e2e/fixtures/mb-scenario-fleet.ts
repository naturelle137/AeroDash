// Synthetic algorithm fixtures for the phase-B M&B journeys. Every mass, arm and
// envelope value is taken unchanged from the existing hard-coded MVP catalogue;
// none of it is POH/AFM data and nothing here validates a real aircraft. The
// profiles are stored as Drafts so the app keeps gating them behind the
// unverified-data acknowledgement, exactly as it would for a pilot.

import type { AircraftContext } from '../../../src/core/domain/aircraft.types'
import { AIRCRAFT_CATALOGUE } from '../../../src/modules/mass-balance/data/aircraft-catalogue'

const SYNTHETIC_DATUM = 'Synthetic E2E fixture — not from a POH/AFM'

const ICAO_TYPE: Readonly<Record<string, string>> = {
  'D-EBPN': 'P208',
  'D-ECSM': 'C172',
  'D-EMTK': 'DR40',
  'D-EAMB': 'P28A',
}

export const MB_SCENARIO_REGISTRATIONS = Object.keys(ICAO_TYPE)

function toStoredDraftProfile(aircraft: AircraftContext, index: number): object {
  return {
    id: `00000000-0000-4000-a000-${String(index + 1).padStart(12, '0')}`,
    ownerId: '00000000-0000-4000-a000-0000000002ff',
    registration: aircraft.registration,
    manufacturer: aircraft.manufacturer,
    model: aircraft.model,
    icaoTypeDesignator: ICAO_TYPE[aircraft.registration],
    sourceUnit: aircraft.sourceUnit,
    referenceDatumDescription: SYNTHETIC_DATUM,
    referenceDatumLocation: SYNTHETIC_DATUM,
    shareCode: null,
    status: 'draft',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: aircraft.weighingReports.map((wr) => ({
      bem: wr.basicEmptyMass,
      emptyCg: wr.emptyCg,
      weighingDate: wr.weighingDate,
      validFrom: wr.validFrom,
    })),
    loadPoints: aircraft.loadPoints,
    certificationCategories: aircraft.certificationCategories.map((cc) => ({
      category: cc.category,
      mtom: cc.maxTakeoffMass,
      maxZeroFuelMass: cc.maxZeroFuelMass,
      graphType: cc.graphType,
      envelope: cc.envelope,
    })),
  }
}

export function mbScenarioFleet(): object[] {
  const selected = AIRCRAFT_CATALOGUE.filter((a) => a.registration in ICAO_TYPE)
  const missing = MB_SCENARIO_REGISTRATIONS.filter(
    (reg) => !selected.some((a) => a.registration === reg),
  )
  if (missing.length > 0) {
    throw new Error(`mb-scenario-fleet: catalogue lacks ${missing.join(', ')}`)
  }
  return selected.map(toStoredDraftProfile)
}
