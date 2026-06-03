/**
 * Occupant-mass preset chips for one-tap mass-station entry.
 *
 * Provenance + revision tracking lives in the data-constants registry:
 *   docs/data_constants/registry.json
 *     #occupant-preset-masses-kg, #occupant-preset-masses-lb
 *
 * These are convenience shortcuts (light / medium / heavy adult), NOT
 * authoritative or regulatory standard masses — the pilot always enters the
 * actual or applicable standard mass. The data-constants gate fails CI if
 * these arrays drift from the registry (see frontend/scripts/data-constants).
 */

// @IMP-MB-DATA-004@ (FROM: @REQ-UQ-001@)
export const OCCUPANT_PRESET_MASSES_KG: readonly number[] = [55, 70, 85]

export const OCCUPANT_PRESET_MASSES_LB: readonly number[] = [120, 160, 200]
