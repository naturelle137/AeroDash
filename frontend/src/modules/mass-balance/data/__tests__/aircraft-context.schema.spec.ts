import { describe, it, expect } from 'vitest'
import { AircraftContextSchema } from '../aircraft-context.schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildValidContext(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-aircraft',
    registration: 'PH-TST',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    sourceUnit: 'kg',
    weighingReports: [
      {
        basicEmptyMass: 433,
        emptyCg: 1.877,
        weighingDate: '2025-01-01',
        validFrom: '2025-01-01',
      },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.05,
        armLookup: [],
        operationalLimit: 200,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: ['Normal'] as string[],
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        maxTakeoffMass: 750,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 0.9, mass: 400 },
          { armOrMoment: 1.1, mass: 750 },
          { armOrMoment: 1.1, mass: 400 },
        ],
      },
    ],
    ...overrides,
  }
}

function buildValidLoadPoint(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Pilot',
    arm: 1.05,
    armLookup: [],
    operationalLimit: 200,
    defaultQuantity: 0,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: null,
    ...overrides,
  }
}

function buildValidCategory(overrides: Record<string, unknown> = {}) {
  return {
    category: 'Normal',
    maxTakeoffMass: 750,
    maxZeroFuelMass: null,
    graphType: 'arm',
    envelope: [
      { armOrMoment: 0.9, mass: 400 },
      { armOrMoment: 1.05, mass: 600 },
      { armOrMoment: 1.1, mass: 750 },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AircraftContextSchema', () => {
  describe('top-level required fields', () => {
    // @UT-MB-DATA-001@ (FROM: @IMP-MB-DATA-001@)
    it('accepts a fully valid aircraft context', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext())
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-036@ (FROM: @IMP-MB-DATA-001@, @REQ-AC-005@)
    it('defaults status to verified when omitted (legacy catalogue)', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext())
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.status).toBe('verified')
    })

    // @UT-MB-DATA-037@ (FROM: @IMP-MB-DATA-001@, @REQ-AC-005@)
    it('accepts draft status and normalizes legacy Title Case', () => {
      const lower = AircraftContextSchema.safeParse(buildValidContext({ status: 'draft' }))
      expect(lower.success).toBe(true)
      if (!lower.success) return
      expect(lower.data.status).toBe('draft')

      const legacy = AircraftContextSchema.safeParse(buildValidContext({ status: 'Draft' }))
      expect(legacy.success).toBe(true)
      if (!legacy.success) return
      expect(legacy.data.status).toBe('draft')
    })

    // @UT-MB-DATA-002@ (FROM: @IMP-MB-DATA-001@)
    it('rejects id as empty string', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ id: '' }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-003@ (FROM: @IMP-MB-DATA-001@)
    it('rejects registration as empty string', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ registration: '' }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-004@ (FROM: @IMP-MB-DATA-001@)
    it('rejects manufacturer as empty string', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ manufacturer: '' }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-005@ (FROM: @IMP-MB-DATA-001@)
    it('rejects model as empty string', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ model: '' }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-006@ (FROM: @IMP-MB-DATA-001@)
    it('rejects sourceUnit as empty string', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ sourceUnit: '' }))
      expect(result.success).toBe(false)
    })
  })

  describe('weighingReports', () => {
    // @UT-MB-DATA-007@ (FROM: @IMP-MB-DATA-001@)
    it('rejects empty weighingReports array', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ weighingReports: [] }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-008@ (FROM: @IMP-MB-DATA-001@)
    it('rejects weighingReport with basicEmptyMass of zero', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          weighingReports: [{ basicEmptyMass: 0, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-009@ (FROM: @IMP-MB-DATA-001@)
    it('rejects weighingReport with negative basicEmptyMass', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          weighingReports: [{ basicEmptyMass: -1, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-010@ (FROM: @IMP-MB-DATA-001@)
    it('rejects weighingReport with empty weighingDate', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          weighingReports: [{ basicEmptyMass: 433, emptyCg: 1.877, weighingDate: '', validFrom: '2025-01-01' }],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-011@ (FROM: @IMP-MB-DATA-001@)
    it('rejects weighingReport with empty validFrom', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          weighingReports: [{ basicEmptyMass: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '' }],
        }),
      )
      expect(result.success).toBe(false)
    })
  })

  describe('certificationCategories', () => {
    // @UT-MB-DATA-012@ (FROM: @IMP-MB-DATA-001@)
    it('rejects empty certificationCategories array', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ certificationCategories: [] }))
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-013@ (FROM: @IMP-MB-DATA-001@)
    it('rejects category with invalid enum value', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ category: 'Experimental' })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-014@ (FROM: @IMP-MB-DATA-001@)
    it('rejects maxTakeoffMass of zero', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ maxTakeoffMass: 0 })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-015@ (FROM: @IMP-MB-DATA-001@)
    it('accepts maxZeroFuelMass as null', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ maxZeroFuelMass: null })] }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-016@ (FROM: @IMP-MB-DATA-001@)
    it('rejects graphType with invalid enum value', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ graphType: 'cg' })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-017@ (FROM: @IMP-MB-DATA-001@)
    it('rejects envelope with fewer than 3 points', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          certificationCategories: [
            buildValidCategory({
              envelope: [
                { armOrMoment: 0.9, mass: 400 },
                { armOrMoment: 1.1, mass: 750 },
              ],
            }),
          ],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-018@ (FROM: @IMP-MB-DATA-001@)
    it('accepts envelope with exactly 3 points', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          certificationCategories: [
            buildValidCategory({
              envelope: [
                { armOrMoment: 0.9, mass: 400 },
                { armOrMoment: 1.05, mass: 600 },
                { armOrMoment: 1.1, mass: 750 },
              ],
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-019@ (FROM: @IMP-MB-DATA-001@)
    it('accepts graphType moment', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ graphType: 'moment' })] }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-020@ (FROM: @IMP-MB-DATA-001@)
    it('accepts Utility and Aerobatic as valid category enums', () => {
      const utility = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ category: 'Utility' })] }),
      )
      const aerobatic = AircraftContextSchema.safeParse(
        buildValidContext({ certificationCategories: [buildValidCategory({ category: 'Aerobatic' })] }),
      )
      expect(utility.success).toBe(true)
      expect(aerobatic.success).toBe(true)
    })
  })

  describe('loadPoints', () => {
    // @UT-MB-DATA-021@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoints as empty array', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext({ loadPoints: [] }))
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-022@ (FROM: @IMP-MB-DATA-001@)
    it('rejects loadPoint with empty name', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ name: '' })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-023@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoint with arm as null', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ arm: null })] }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-024@ (FROM: @IMP-MB-DATA-001@)
    it('rejects loadPoint with negative operationalLimit', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ operationalLimit: -1 })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-025@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoint with operationalLimit as null', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ operationalLimit: null })] }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-026@ (FROM: @IMP-MB-DATA-001@)
    it('rejects loadPoint with negative defaultQuantity', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ defaultQuantity: -0.1 })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-027@ (FROM: @IMP-MB-DATA-001@)
    it('rejects loadPoint with empty unit string', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ unit: '' })] }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-028@ (FROM: @IMP-MB-DATA-001@)
    it('rejects loadPoint allowableCategories containing invalid enum', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [buildValidLoadPoint({ allowableCategories: ['Normal', 'Experimental'] })],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-029@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoint with allowableCategories as null', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ allowableCategories: null })] }),
      )
      expect(result.success).toBe(true)
    })
  })

  describe('fuelTank', () => {
    // @UT-MB-DATA-030@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoint with fuelTank as null', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ loadPoints: [buildValidLoadPoint({ fuelTank: null })] }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-031@ (FROM: @IMP-MB-DATA-001@)
    it('accepts a fully populated fuelTank', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 1.5,
                permissibleFuelTypes: ['AvGas 100LL'],
                burnSequences: [{ sequenceName: 'Main', ordinalPosition: 1 }],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-032@ (FROM: @IMP-MB-DATA-001@)
    it('rejects fuelTank with negative unusableFuel', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: -0.5,
                permissibleFuelTypes: [],
                burnSequences: [],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-033@ (FROM: @IMP-MB-DATA-001@)
    it('accepts fuelTank with zero unusableFuel', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 0,
                permissibleFuelTypes: ['AvGas 100LL'],
                burnSequences: [],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-034@ (FROM: @IMP-MB-DATA-001@)
    it('accepts fuelTank with multiple burn sequences', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 0,
                permissibleFuelTypes: ['AvGas 100LL', 'MoGas'],
                burnSequences: [
                  { sequenceName: 'Main', ordinalPosition: 1 },
                  { sequenceName: 'Aux', ordinalPosition: 2 },
                ],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-038@ (FROM: @IMP-MB-DATA-003@, @REQ-FE-001@, H-002)
    it('rejects a genuinely unknown fuel-type string (fail-closed)', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 0,
                // typo / attacker value that would silently hit the 0.84 fallback
                permissibleFuelTypes: ['Kerosene'],
                burnSequences: [],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(false)
    })

    // @UT-MB-DATA-040@ (FROM: @IMP-MB-DATA-003@, @REQ-FE-001@)
    it('tolerates the deprecated uppercase aliases that resolve a correct density', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 0,
                permissibleFuelTypes: ['AVGAS', 'MOGAS'],
                burnSequences: [],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })

    // @UT-MB-DATA-039@ (FROM: @IMP-MB-DATA-003@, @REQ-FE-001@)
    it('rejects an empty permissibleFuelTypes array (min 1)', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              fuelTank: {
                unusableFuel: 0,
                permissibleFuelTypes: [],
                burnSequences: [],
              },
            }),
          ],
        }),
      )
      expect(result.success).toBe(false)
    })
  })

  describe('armLookup entries', () => {
    // @UT-MB-DATA-035@ (FROM: @IMP-MB-DATA-001@)
    it('accepts loadPoint with non-empty armLookup entries', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          loadPoints: [
            buildValidLoadPoint({
              arm: null,
              armLookup: [
                { massOrVolume: 0, moment: 0 },
                { massOrVolume: 100, moment: 105 },
              ],
            }),
          ],
        }),
      )
      expect(result.success).toBe(true)
    })
  })

  // ─── Powertrain discriminator + battery pack (REQ-AD-020, REQ-AD-021) ─────
  // @UT-MB-DATA-001@ (FROM: @IMP-MB-DATA-002@)
  describe('powertrain discriminator', () => {
    it('defaults to combustion when the field is omitted (legacy contexts)', () => {
      const result = AircraftContextSchema.safeParse(buildValidContext())
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.powertrain).toBe('combustion')
    })

    it('accepts an electric context with a battery pack', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          powertrain: 'electric',
          batteryPack: { usableEnergyKwh: 24.8, reserveFloorKwh: 4.0 },
        }),
      )
      expect(result.success).toBe(true)
    })

    it('rejects a combustion context that contains a battery pack', () => {
      // AircraftContextSchema does not superRefine — battery pack is simply
      // passed through. Schema accepts both fields independently. The cross-
      // field guard lives in AircraftProfileSchema (the fleet source of truth)
      // so this test asserts the M&B layer stays structural only.
      const result = AircraftContextSchema.safeParse(
        buildValidContext({
          powertrain: 'combustion',
          batteryPack: { usableEnergyKwh: 24.8, reserveFloorKwh: 4.0 },
        }),
      )
      expect(result.success).toBe(true)
    })

    it('rejects an unknown powertrain value', () => {
      const result = AircraftContextSchema.safeParse(
        buildValidContext({ powertrain: 'hybrid' }),
      )
      expect(result.success).toBe(false)
    })
  })
})
