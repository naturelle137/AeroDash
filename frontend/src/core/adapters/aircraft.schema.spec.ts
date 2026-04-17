import { describe, it, expect } from 'vitest'
import { AircraftProfileSchema } from './aircraft.schema'

/**
 * Minimal valid profile fixture.
 * All tests mutate a deep clone of this to exercise a single validation path.
 */
function createValidProfile(): unknown {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'user-123',
    registration: 'D-EBPF',
    manufacturer: 'Klemm',
    model: '107B',
    icaoTypeDesignator: 'K17B',
    sourceUnit: 'kg-m',
    referenceDatumDescription: 'Leading edge of the wing root',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    weighingReports: [
      {
        bem: 415.0,
        emptyCg: 0.782,
        weighingDate: '2025-01-15',
        validFrom: '2025-01-15',
      },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 0.85,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 750,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 0.72, mass: 415 },
          { armOrMoment: 0.72, mass: 750 },
          { armOrMoment: 0.95, mass: 750 },
          { armOrMoment: 0.95, mass: 415 },
        ],
      },
    ],
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function cloneWith(overrides: (profile: Record<string, unknown>) => void): unknown {
  const profile = createValidProfile() as Record<string, unknown>
  overrides(profile)
  return profile
}

// ─── Valid profiles ───────────────────────────────────────────────────────────

describe('AircraftProfileSchema — valid profiles', () => {
  // @UT-AD-CORE-014@ (FROM: @IMP-AD-CORE-004@)
  it('accepts a fully-populated minimal valid profile', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-015@ (FROM: @IMP-AD-CORE-004@)
  it('accepts a profile with shareCode as a non-null string', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.shareCode = 'ABC-123'
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-016@ (FROM: @IMP-AD-CORE-004@)
  it('accepts a profile with arm = 0 (zero is a valid scalar arm, not absent)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = 0
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-017@ (FROM: @IMP-AD-CORE-004@)
  it('accepts a load point using an armLookup table instead of a scalar arm', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = null
        lps[0]!.armLookup = [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 50, moment: 45 },
        ]
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-018@ (FROM: @IMP-AD-CORE-004@)
  it('accepts exactly 20 load points (upper boundary)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.loadPoints = Array.from({ length: 20 }, (_, i) => ({
          name: `Station ${i}`,
          arm: 0.5 + i * 0.01,
          armLookup: [],
          operationalLimit: null,
          defaultQuantity: 0,
          unit: 'kg',
          allowableCategories: null,
          fuelTank: null,
        }))
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-019@ (FROM: @IMP-AD-CORE-004@)
  it('accepts exactly 4 envelope points (lower boundary)', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.certificationCategories[0]!.envelope).toHaveLength(4)
  })

  // @UT-AD-CORE-020@ (FROM: @IMP-AD-CORE-004@)
  it('accepts exactly 10 fuel tank load points (upper boundary)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.loadPoints = Array.from({ length: 10 }, (_, i) => ({
          name: `Tank ${i}`,
          arm: 0.8 + i * 0.01,
          armLookup: [],
          operationalLimit: 100,
          defaultQuantity: 0,
          unit: 'L',
          allowableCategories: null,
          fuelTank: {
            unusableFuel: 1,
            permissibleFuelTypes: ['AvGas 100LL'],
            burnSequences: [{ sequenceName: 'Standard', ordinalPosition: i + 1 }],
          },
        }))
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-021@ (FROM: @IMP-AD-CORE-004@)
  it('accepts multiple certification categories (Normal + Utility)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as unknown[]
        cats.push({
          category: 'Utility',
          mtom: 680,
          maxZeroFuelMass: null,
          graphType: 'arm',
          envelope: [
            { armOrMoment: 0.74, mass: 415 },
            { armOrMoment: 0.74, mass: 680 },
            { armOrMoment: 0.93, mass: 680 },
            { armOrMoment: 0.93, mass: 415 },
          ],
        })
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-022@ (FROM: @IMP-AD-CORE-004@)
  it('accepts optional M4 placeholder field performanceProfiles when provided as array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [{ flightPhase: 'TakeoffRoll', dataPoints: [] }]
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AC-CORE-001@ (FROM: @IMP-AC-CORE-002@)
  it('defaults status to draft when status is omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('draft')
  })

  // @UT-AC-CORE-002@ (FROM: @IMP-AC-CORE-002@)
  it('accepts status = verified and normalizes legacy Title Case', () => {
    const lower = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.status = 'verified'
      }),
    )
    expect(lower.success).toBe(true)
    if (!lower.success) return
    expect(lower.data.status).toBe('verified')

    const legacy = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.status = 'Verified'
      }),
    )
    expect(legacy.success).toBe(true)
    if (!legacy.success) return
    expect(legacy.data.status).toBe('verified')
  })

  // @UT-AC-CORE-003@ (FROM: @IMP-AC-CORE-002@)
  it('rejects an invalid status value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.status = 'Pending'
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AC-CORE-004@ (FROM: @IMP-AC-CORE-002@)
  it('defaults schemaVersion to 1 when omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schemaVersion).toBe(1)
  })

  // @UT-AC-CORE-005@ (FROM: @IMP-AC-CORE-002@)
  it('rejects schemaVersion = 0 (must be positive integer)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.schemaVersion = 0
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AC-CORE-006@ (FROM: @IMP-AC-CORE-001@)
  it('defaults passengerProfiles to empty array when omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.passengerProfiles).toEqual([])
  })

  // @UT-AC-CORE-007@ (FROM: @IMP-AC-CORE-001@)
  it('accepts valid passengerProfiles array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.passengerProfiles = [
          { name: 'Adult', standardWeight: 86, unit: 'kg' },
          { name: 'Child', standardWeight: 35, unit: 'kg' },
        ]
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AC-CORE-008@ (FROM: @IMP-AC-CORE-001@)
  it('rejects a passengerProfile with standardWeight = 0', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.passengerProfiles = [{ name: 'Adult', standardWeight: 0, unit: 'kg' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AC-CORE-009@ (FROM: @IMP-AC-CORE-001@)
  it('rejects a passengerProfile with an invalid unit', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.passengerProfiles = [{ name: 'Adult', standardWeight: 86, unit: 'stone' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-045@ (FROM: @IMP-AD-CORE-008@)
  it('accepts valid costPerHour when provided', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 120
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-046@ (FROM: @IMP-AD-CORE-008@)
  it('accepts costPerHour = 0 (zero is valid, nonnegative)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 0
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-047@ (FROM: @IMP-AD-CORE-008@)
  it('rejects a negative costPerHour', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = -10
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-048@ (FROM: @IMP-AD-CORE-008@)
  it('accepts valid checklistScaffold when provided', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.checklistScaffold = [
          { title: 'Before Takeoff', items: ['Check fuel', 'Trim set'] },
          { title: 'Cruise', items: [] },
        ]
      }),
    )
    expect(result.success).toBe(true)
  })

  // @UT-AD-CORE-049@ (FROM: @IMP-AD-CORE-008@)
  it('rejects a checklistScaffold item with an empty title', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.checklistScaffold = [{ title: '', items: [] }]
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Missing required root fields ────────────────────────────────────────────

describe('AircraftProfileSchema — missing required root fields', () => {
  const requiredRootFields = [
    'id',
    'ownerId',
    'registration',
    'manufacturer',
    'model',
    'icaoTypeDesignator',
    'sourceUnit',
    'referenceDatumDescription',
    'referenceDatumLocation',
    'weighingReports',
    'loadPoints',
    'certificationCategories',
  ] as const

  // @UT-AD-CORE-023@ (FROM: @IMP-AD-CORE-004@)
  it.each(requiredRootFields)('rejects a profile when "%s" is missing', (field) => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        delete p[field]
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-024@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile when "id" is not a valid UUID', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.id = 'not-a-uuid'
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-025@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile when "weighingReports" is an empty array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.weighingReports = []
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-026@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile when "certificationCategories" is an empty array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.certificationCategories = []
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Load point violations ────────────────────────────────────────────────────

describe('AircraftProfileSchema — load point violations', () => {
  // @UT-AD-CORE-027@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile with more than 20 load points', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.loadPoints = Array.from({ length: 21 }, (_, i) => ({
          name: `Station ${i}`,
          arm: 0.5 + i * 0.01,
          armLookup: [],
          operationalLimit: null,
          defaultQuantity: 0,
          unit: 'kg',
          allowableCategories: null,
          fuelTank: null,
        }))
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-028@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile when a load point has both arm and a non-empty armLookup (XOR)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = 0.85
        lps[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }]
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'NOT_ALLOWED' && i.path[2] === 'arm',
    )
    expect(issue).toBeDefined()
  })

  // @UT-AD-CORE-029@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile when a load point has arm = null and empty armLookup (XOR)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = null
        lps[0]!.armLookup = []
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'REQUIRED' && i.path[2] === 'arm',
    )
    expect(issue).toBeDefined()
  })

  // @UT-AD-CORE-030@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a profile with more than 10 fuel tanks', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.loadPoints = Array.from({ length: 11 }, (_, i) => ({
          name: `Tank ${i}`,
          arm: 0.8 + i * 0.01,
          armLookup: [],
          operationalLimit: 100,
          defaultQuantity: 0,
          unit: 'L',
          allowableCategories: null,
          fuelTank: {
            unusableFuel: 1,
            permissibleFuelTypes: ['AvGas 100LL'],
            burnSequences: [],
          },
        }))
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find((i) => i.message === 'TOO_MANY_FUEL_TANKS')
    expect(issue).toBeDefined()
  })

  // @UT-AD-CORE-031@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a load point with a missing required name field', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        delete (lps[0] as Record<string, unknown>).name
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-032@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a load point with an invalid allowableCategories value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.allowableCategories = ['InvalidCategory']
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Certification category / envelope violations ─────────────────────────────

describe('AircraftProfileSchema — certification category and envelope violations', () => {
  // @UT-AD-CORE-033@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a certification category with fewer than 4 envelope points', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.envelope = [
          { armOrMoment: 0.72, mass: 415 },
          { armOrMoment: 0.72, mass: 750 },
          { armOrMoment: 0.95, mass: 750 },
        ]
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-034@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a certification category with more than 20 envelope points', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.envelope = Array.from({ length: 21 }, (_, i) => ({
          armOrMoment: 0.7 + i * 0.01,
          mass: 415,
        }))
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-035@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a certification category with an invalid graphType enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.graphType = 'degrees'
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-036@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a certification category with an invalid category enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.category = 'Experimental'
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-037@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a certification category with a non-positive mtom', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.mtom = -100
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── WeighingReport violations ────────────────────────────────────────────────

describe('AircraftProfileSchema — weighing report violations', () => {
  // @UT-AD-CORE-038@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a weighing report with a non-positive bem', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const reports = p.weighingReports as Record<string, unknown>[]
        reports[0]!.bem = 0
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-039@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a weighing report with a missing weighingDate', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const reports = p.weighingReports as Record<string, unknown>[]
        delete (reports[0] as Record<string, unknown>).weighingDate
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Fuel tank extension violations ──────────────────────────────────────────

describe('AircraftProfileSchema — fuel tank extension violations', () => {
  // @UT-AD-CORE-040@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a fuel tank with an invalid permissible fuel type', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = null
        lps[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }]
        lps[0]!.fuelTank = {
          unusableFuel: 2,
          permissibleFuelTypes: ['Kerosene'],
          burnSequences: [],
        }
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-041@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a fuel tank with an empty permissibleFuelTypes array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = null
        lps[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }]
        lps[0]!.fuelTank = {
          unusableFuel: 2,
          permissibleFuelTypes: [],
          burnSequences: [],
        }
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-042@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a fuel tank with a negative unusableFuel value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = null
        lps[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }]
        lps[0]!.fuelTank = {
          unusableFuel: -1,
          permissibleFuelTypes: ['AvGas 100LL'],
          burnSequences: [],
        }
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Wind limit violations ────────────────────────────────────────────────────

describe('AircraftProfileSchema — wind limit violations', () => {
  // @UT-AD-CORE-043@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a wind limit with an invalid component enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.windLimits = [{ component: 'MaxHeadwind', value: 20, classification: 'Limit' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  // @UT-AD-CORE-044@ (FROM: @IMP-AD-CORE-004@)
  it('rejects a wind limit with an invalid classification enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.windLimits = [{ component: 'MaxCrosswind', value: 15, classification: 'Advisory' }]
      }),
    )
    expect(result.success).toBe(false)
  })
})
