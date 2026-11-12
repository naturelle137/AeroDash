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
  it('accepts a fully-populated minimal valid profile', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
  })

  it('accepts a profile with shareCode as a non-null string', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.shareCode = 'ABC-123'
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a profile with arm = 0 (zero is a valid scalar arm, not absent)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = 0
      }),
    )
    expect(result.success).toBe(true)
  })

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

  it('accepts exactly 4 envelope points (lower boundary)', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.certificationCategories[0]!.envelope).toHaveLength(4)
  })

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

  it('accepts optional M4 placeholder field performanceProfiles when provided as array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [{ flightPhase: 'TakeoffRoll', dataPoints: [] }]
      }),
    )
    expect(result.success).toBe(true)
  })

  it('defaults status to draft when status is omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('draft')
  })

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

  it('normalizes legacy Title-Case status = Draft to canonical draft', () => {
    const legacyDraft = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.status = 'Draft'
      }),
    )
    expect(legacyDraft.success).toBe(true)
    if (!legacyDraft.success) return
    expect(legacyDraft.data.status).toBe('draft')
  })

  it('rejects an invalid status value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.status = 'Pending'
      }),
    )
    expect(result.success).toBe(false)
  })

  it('defaults schemaVersion to 1 when omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schemaVersion).toBe(1)
  })

  it('rejects schemaVersion = 0 (must be positive integer)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.schemaVersion = 0
      }),
    )
    expect(result.success).toBe(false)
  })

  it('defaults passengerProfiles to empty array when omitted', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.passengerProfiles).toEqual([])
  })

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

  it('rejects a passengerProfile with standardWeight = 0', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.passengerProfiles = [{ name: 'Adult', standardWeight: 0, unit: 'kg' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a passengerProfile with an invalid unit', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.passengerProfiles = [{ name: 'Adult', standardWeight: 86, unit: 'stone' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('accepts valid costPerHour when provided', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 120
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts costPerHour = 0 (zero is valid, nonnegative)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 0
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a negative costPerHour', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = -10
      }),
    )
    expect(result.success).toBe(false)
  })

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

  it.each(requiredRootFields)('rejects a profile when "%s" is missing', (field) => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        delete p[field]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a profile when "id" is not a valid UUID', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.id = 'not-a-uuid'
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a profile when "weighingReports" is an empty array', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.weighingReports = []
      }),
    )
    expect(result.success).toBe(false)
  })

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

  it('rejects a load point with a missing required name field', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        delete (lps[0] as Record<string, unknown>).name
      }),
    )
    expect(result.success).toBe(false)
  })

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

  it('rejects a certification category with an invalid graphType enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.graphType = 'degrees'
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a certification category with an invalid category enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.category = 'Experimental'
      }),
    )
    expect(result.success).toBe(false)
  })

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
  it('rejects a weighing report with a non-positive bem', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const reports = p.weighingReports as Record<string, unknown>[]
        reports[0]!.bem = 0
      }),
    )
    expect(result.success).toBe(false)
  })

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

// ─── Operating cost violations (REQ-AD-006) ─────────────────────────────────

describe('AircraftProfileSchema — operating cost (fuelCostIncluded)', () => {
  it('accepts fuelCostIncluded = true alongside costPerHour', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 180
        p.fuelCostIncluded = true
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.fuelCostIncluded).toBe(true)
  })

  it('accepts fuelCostIncluded = false alongside costPerHour', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.costPerHour = 180
        p.fuelCostIncluded = false
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.fuelCostIncluded).toBe(false)
  })

  it('rejects a non-boolean fuelCostIncluded value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.fuelCostIncluded = 'yes'
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Performance profile validation (REQ-AD-008, REQ-AD-009) ────────────────

describe('AircraftProfileSchema — performance profiles', () => {
  it('accepts a performance profile with a valid flight phase and empty data points', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [{ flightPhase: 'TakeoffRoll', dataPoints: [] }]
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts all four documented flight phases', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          { flightPhase: 'TakeoffRoll', dataPoints: [] },
          { flightPhase: 'TakeoffDistance50ft', dataPoints: [] },
          { flightPhase: 'LandingRoll', dataPoints: [] },
          { flightPhase: 'LandingDistance50ft', dataPoints: [] },
        ]
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a performance profile with an invalid flight phase enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [{ flightPhase: 'Climb', dataPoints: [] }]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('accepts exactly 1000 performance data points (upper boundary)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          {
            flightPhase: 'TakeoffDistance50ft',
            dataPoints: Array.from({ length: 1000 }, (_, i) => ({
              distance: 100 + i,
              mass: 600,
              pressureAltitude: i,
              temperature: 15,
            })),
          },
        ]
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a performance profile with more than 1000 data points', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          {
            flightPhase: 'TakeoffDistance50ft',
            dataPoints: Array.from({ length: 1001 }, (_, i) => ({
              distance: 100 + i,
              mass: 600,
              pressureAltitude: i,
              temperature: 15,
            })),
          },
        ]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a performance data point missing the required mass field', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          {
            flightPhase: 'LandingRoll',
            dataPoints: [{ distance: 200, pressureAltitude: 0, temperature: 15 }],
          },
        ]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a performance data point with non-positive mass', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          {
            flightPhase: 'LandingRoll',
            dataPoints: [{ distance: 200, mass: 0, pressureAltitude: 0, temperature: 15 }],
          },
        ]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a performance data point with a negative distance', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.performanceProfiles = [
          {
            flightPhase: 'LandingDistance50ft',
            dataPoints: [{ distance: -1, mass: 600, pressureAltitude: 0, temperature: 15 }],
          },
        ]
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Wind limit violations ────────────────────────────────────────────────────

describe('AircraftProfileSchema — wind limit violations', () => {
  it('rejects a wind limit with an invalid component enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.windLimits = [{ component: 'MaxHeadwind', value: 20, classification: 'Limit' }]
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a wind limit with an invalid classification enum', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.windLimits = [{ component: 'MaxCrosswind', value: 15, classification: 'Advisory' }]
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Powertrain discriminator + battery pack (REQ-AD-020, REQ-AD-021) ───────

describe('AircraftProfileSchema — powertrain discriminator', () => {
  it('defaults powertrain to "combustion" when the field is omitted (legacy records)', () => {
    const result = AircraftProfileSchema.safeParse(createValidProfile())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.powertrain).toBe('combustion')
  })

  it('accepts an explicit combustion profile without a battery pack', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'combustion'
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a combustion profile that also carries a battery pack', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'combustion'
        p.batteryPack = { usableEnergyKwh: 24.8, reserveFloorKwh: 4.0 }
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION',
    )
    expect(issue).toBeDefined()
  })

  it('accepts an electric profile with a valid battery pack', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = {
          usableEnergyKwh: 24.8,
          reserveFloorKwh: 4.0,
          nominalVoltage: 345,
          chemistry: 'LiFePO4',
        }
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts an electric profile with only the required battery fields', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: 24.8, reserveFloorKwh: 4.0 }
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects an electric profile with no battery pack', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'BATTERY_PACK_REQUIRED_FOR_ELECTRIC',
    )
    expect(issue).toBeDefined()
  })

  it('rejects an electric profile where the reserve floor equals usable energy', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: 24.8, reserveFloorKwh: 24.8 }
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'RESERVE_EXCEEDS_USABLE_ENERGY',
    )
    expect(issue).toBeDefined()
  })

  it('rejects an electric profile where the reserve floor exceeds usable energy', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: 24.8, reserveFloorKwh: 30.0 }
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a battery pack with non-positive usable energy', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: 0, reserveFloorKwh: 0 }
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an electric profile that still carries a fuel tank load point', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: 24.8, reserveFloorKwh: 4.0 }
        p.loadPoints = [
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
          {
            name: 'Main Fuel',
            arm: 1.1,
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
          },
        ]
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find(
      (i) => i.message === 'ELECTRIC_AIRCRAFT_HAS_FUEL_TANK',
    )
    expect(issue).toBeDefined()
  })

  it('rejects an unknown powertrain value', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'hybrid'
      }),
    )
    expect(result.success).toBe(false)
  })
})

// ─── Finite + numeric domain ranges ──────────────────────────────────────────

describe('AircraftProfileSchema — finite + numeric range guards', () => {
  it('rejects Infinity for bem (Zod number() would otherwise accept it)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const reports = p.weighingReports as Record<string, unknown>[]
        reports[0]!.bem = Infinity
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects -Infinity for a load point arm', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.arm = -Infinity
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects NaN for mtom', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.mtom = NaN
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an absurd mtom magnitude (1e308) as out of physical range', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.mtom = 1e308
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an absurd bem magnitude (1e30)', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const reports = p.weighingReports as Record<string, unknown>[]
        reports[0]!.bem = 1e30
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects Infinity for batteryPack.usableEnergyKwh', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.powertrain = 'electric'
        p.batteryPack = { usableEnergyKwh: Infinity, reserveFloorKwh: 4 }
        // electric forbids fuel tanks; the minimal fixture has none.
      }),
    )
    expect(result.success).toBe(false)
  })

  it('still accepts a near-edge finite mtom (199_999 kg) just under the ceiling', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const cats = p.certificationCategories as Record<string, unknown>[]
        cats[0]!.mtom = 199_999
        // keep envelope mass below mtom so no cross-field surprise; not enforced
        // here but realistic.
      }),
    )
    expect(result.success).toBe(true)
  })
})

// ─── Verification provenance (REQ-AC-007) ──────────────────────────────────────

describe('AircraftProfileSchema — verification provenance', () => {
  const validVerification = {
    verifiedOn: '2026-01-10',
    verifiedBy: 'JS',
    pohRevision: 'Rev 7',
    sourceWeighingDate: '2025-01-15',
  }

  it('accepts a Verified profile carrying a full verification block', () => {
    const parsed = AircraftProfileSchema.parse(
      cloneWith((p) => {
        p.status = 'verified'
        p.verification = { ...validVerification }
      }),
    )
    expect(parsed.verification?.pohRevision).toBe('Rev 7')
    expect(parsed.verification?.sourceWeighingDate).toBe('2025-01-15')
  })

  it('leaves verification undefined when omitted (optional for legacy records)', () => {
    const parsed = AircraftProfileSchema.parse(createValidProfile())
    expect(parsed.verification).toBeUndefined()
  })

  it('rejects a verifiedOn that is not a YYYY-MM-DD calendar date', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        p.verification = { ...validVerification, verifiedOn: '10/01/2026' }
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a verifiedOn that is well-formed but an impossible calendar date', () => {
    for (const bad of ['2026-13-45', '2026-02-30', '2026-00-10', '2026-01-32']) {
      const result = AircraftProfileSchema.safeParse(
        cloneWith((p) => {
          p.verification = { ...validVerification, verifiedOn: bad }
        }),
      )
      expect(result.success, `expected ${bad} to be rejected`).toBe(false)
    }
  })

  it('rejects empty verifiedBy / pohRevision and over-long values', () => {
    expect(
      AircraftProfileSchema.safeParse(
        cloneWith((p) => {
          p.verification = { ...validVerification, verifiedBy: '' }
        }),
      ).success,
    ).toBe(false)
    expect(
      AircraftProfileSchema.safeParse(
        cloneWith((p) => {
          p.verification = { ...validVerification, pohRevision: 'x'.repeat(41) }
        }),
      ).success,
    ).toBe(false)
  })
})

describe('AircraftProfileSchema — station kind', () => {
  it('accepts a legacy load point without kind', () => {
    expect(AircraftProfileSchema.safeParse(createValidProfile()).success).toBe(true)
  })

  it('accepts occupant and baggage kinds on non-fuel stations and keeps them', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lps = p.loadPoints as Record<string, unknown>[]
        lps[0]!.kind = 'occupant'
        lps.push({ ...lps[0]!, name: 'Baggage', kind: 'baggage' })
      }),
    )
    expect(result.success).toBe(true)
    expect(result.data?.loadPoints.map((lp) => lp.kind)).toEqual(['occupant', 'baggage'])
  })

  it('rejects kind fuel on a station without a fuel tank', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        ;(p.loadPoints as Record<string, unknown>[])[0]!.kind = 'fuel'
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message === 'STATION_KIND_MISMATCH')).toBe(true)
  })

  it('rejects a non-fuel kind on a station with a fuel tank', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        const lp = (p.loadPoints as Record<string, unknown>[])[0]!
        lp.kind = 'baggage'
        lp.fuelTank = { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] }
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message === 'STATION_KIND_MISMATCH')).toBe(true)
  })

  it('rejects an unknown kind', () => {
    const result = AircraftProfileSchema.safeParse(
      cloneWith((p) => {
        ;(p.loadPoints as Record<string, unknown>[])[0]!.kind = 'cargo'
      }),
    )
    expect(result.success).toBe(false)
  })
})

describe('configured occupancy', () => {
  it.each(['required', 'optional'])('preserves %s occupancy without a schema migration', (occupancy) => {
    const input = cloneWith((p) => { (p.loadPoints as Record<string, unknown>[])[0]!.occupancy = occupancy })
    const parsed = AircraftProfileSchema.parse(input)
    expect(parsed.loadPoints[0]!.occupancy).toBe(occupancy)
  })
  it('accepts omitted legacy occupancy', () => {
    expect(AircraftProfileSchema.parse(createValidProfile()).loadPoints[0]!.occupancy).toBeUndefined()
  })
  it.each(['', 'sometimes', null, false])('rejects invalid occupancy %s', (occupancy) => {
    const input = cloneWith((p) => { (p.loadPoints as Record<string, unknown>[])[0]!.occupancy = occupancy })
    expect(AircraftProfileSchema.safeParse(input).success).toBe(false)
  })
  it.each([-1, NaN, Infinity, '', undefined])('rejects invalid configured quantity %s on an optional seat', (value) => {
    const input = cloneWith((p) => { Object.assign((p.loadPoints as Record<string, unknown>[])[0]!, { occupancy: 'optional', defaultQuantity: value }) })
    expect(AircraftProfileSchema.safeParse(input).success).toBe(false)
  })
})
