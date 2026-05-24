// @IMP-AC-TEST-FIXTURE-001@ (FROM: @REQ-AC-001@)
// Canonical "Tecnam P2008 JC" test aircraft used across multiple E2E scenarios.
// Using this single fixture guarantees all wizard-creation scenarios exercise
// the same known-good data and makes future baseline changes a one-liner.

export const TEST_AIRCRAFT = {
  registration: 'D-EBPN',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  icaoDesignator: 'P208',
  mtom: '630',
  bem: '433',
  emptyCg: '1.882',
  seatStationName: 'Pilot & Passenger',
  seatStationArm: '1.145',
  fuelTankName: 'Fuel Tank',
} as const
