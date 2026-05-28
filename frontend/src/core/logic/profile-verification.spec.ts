/**
 * Unit tests for profile-verification.ts (P1 Safety Core).
 *
 * @see frontend/src/core/logic/profile-verification.ts
 */

// @UT-AC-CORE-104@ (FROM: @IMP-AC-CORE-005@)

import { describe, it, expect } from 'vitest'
import {
  VERIFICATION_VALIDITY_DAYS,
  evaluateVerificationFreshness,
  type VerifiableProfile,
} from './profile-verification'
import type { AircraftProfileVerification } from '../adapters/aircraft.schema'

const SOURCE_DATE = '2026-01-10'

function provenance(overrides: Partial<AircraftProfileVerification> = {}): AircraftProfileVerification {
  return {
    verifiedOn: '2026-01-10',
    verifiedBy: 'JS',
    pohRevision: 'Rev 7',
    sourceWeighingDate: SOURCE_DATE,
    ...overrides,
  }
}

function profile(overrides: Partial<VerifiableProfile> = {}): VerifiableProfile {
  return {
    status: 'verified',
    verification: provenance(),
    weighingReports: [{ validFrom: SOURCE_DATE }],
    ...overrides,
  }
}

/** A fixed UTC instant N days after the verifiedOn date used by `provenance()`. */
function daysAfterVerified(days: number): Date {
  return new Date(Date.parse(`${SOURCE_DATE}T00:00:00.000Z`) + days * 86_400_000)
}

describe('VERIFICATION_VALIDITY_DAYS', () => {
  it('is a fixed 90-day window', () => {
    expect(VERIFICATION_VALIDITY_DAYS).toBe(90)
  })
})

describe('evaluateVerificationFreshness — draft + unattributed', () => {
  // @UT-AC-CORE-105@ (FROM: @IMP-AC-CORE-005@)
  it('reports draft for a non-verified profile and never requires re-verification', () => {
    const result = evaluateVerificationFreshness(
      profile({ status: 'draft', verification: undefined }),
      daysAfterVerified(0),
    )
    expect(result.state).toBe('draft')
    expect(result.requiresReverification).toBe(false)
    expect(result.provenance).toBeNull()
    expect(result.expiresOn).toBeNull()
    expect(result.daysUntilExpiry).toBeNull()
  })

  // @UT-AC-CORE-106@ (FROM: @IMP-AC-CORE-005@)
  it('reports verified-unattributed for a legacy Verified profile without provenance', () => {
    const result = evaluateVerificationFreshness(
      profile({ verification: undefined }),
      daysAfterVerified(0),
    )
    expect(result.state).toBe('verified-unattributed')
    // Legacy verified records are not mass-invalidated.
    expect(result.requiresReverification).toBe(false)
    expect(result.provenance).toBeNull()
  })
})

describe('evaluateVerificationFreshness — fresh window', () => {
  // @UT-AC-CORE-107@ (FROM: @IMP-AC-CORE-005@)
  it('is fresh on the verification day with the full window remaining', () => {
    const result = evaluateVerificationFreshness(profile(), daysAfterVerified(0))
    expect(result.state).toBe('fresh')
    expect(result.requiresReverification).toBe(false)
    expect(result.daysUntilExpiry).toBe(VERIFICATION_VALIDITY_DAYS)
    expect(result.expiresOn).toBe('2026-04-10')
    expect(result.provenance).toEqual(provenance())
  })

  // @UT-AC-CORE-108@ (FROM: @IMP-AC-CORE-005@)
  it('is fresh one day before expiry', () => {
    const result = evaluateVerificationFreshness(
      profile(),
      daysAfterVerified(VERIFICATION_VALIDITY_DAYS - 1),
    )
    expect(result.state).toBe('fresh')
    expect(result.daysUntilExpiry).toBe(1)
  })
})

describe('evaluateVerificationFreshness — aged expiry', () => {
  // @UT-AC-CORE-109@ (FROM: @IMP-AC-CORE-005@)
  it('is expired exactly on the expiry day (boundary)', () => {
    const result = evaluateVerificationFreshness(
      profile(),
      daysAfterVerified(VERIFICATION_VALIDITY_DAYS),
    )
    expect(result.state).toBe('expired-aged')
    expect(result.requiresReverification).toBe(true)
    expect(result.daysUntilExpiry).toBe(0)
    expect(result.expiresOn).toBe('2026-04-10')
  })

  // @UT-AC-CORE-110@ (FROM: @IMP-AC-CORE-005@)
  it('is expired well past the window with a negative days-remaining', () => {
    const result = evaluateVerificationFreshness(
      profile(),
      daysAfterVerified(VERIFICATION_VALIDITY_DAYS + 30),
    )
    expect(result.state).toBe('expired-aged')
    expect(result.daysUntilExpiry).toBe(-30)
  })

  // @UT-AC-CORE-111@ (FROM: @IMP-AC-CORE-005@)
  it('fails closed (expired) when verifiedOn is structurally unparseable', () => {
    const result = evaluateVerificationFreshness(
      profile({ verification: provenance({ verifiedOn: 'not-a-date' }) }),
      daysAfterVerified(0),
    )
    expect(result.state).toBe('expired-aged')
    expect(result.requiresReverification).toBe(true)
    expect(result.expiresOn).toBeNull()
    expect(result.daysUntilExpiry).toBeNull()
  })
})

describe('evaluateVerificationFreshness — source change', () => {
  // @UT-AC-CORE-112@ (FROM: @IMP-AC-CORE-005@)
  it('is expired-source-changed when the active weighing report no longer matches the sign-off', () => {
    const result = evaluateVerificationFreshness(
      profile({ weighingReports: [{ validFrom: '2026-02-01' }] }),
      daysAfterVerified(0),
    )
    expect(result.state).toBe('expired-source-changed')
    expect(result.requiresReverification).toBe(true)
    expect(result.expiresOn).toBeNull()
  })

  // @UT-AC-CORE-113@ (FROM: @IMP-AC-CORE-005@)
  it('source-change takes precedence over an otherwise-fresh window', () => {
    const result = evaluateVerificationFreshness(
      profile({ weighingReports: [{ validFrom: '2030-01-01' }] }),
      daysAfterVerified(1),
    )
    expect(result.state).toBe('expired-source-changed')
  })

  // @UT-AC-CORE-114@ (FROM: @IMP-AC-CORE-005@)
  it('is expired-source-changed when the profile has no weighing report at all', () => {
    const result = evaluateVerificationFreshness(profile({ weighingReports: [] }), daysAfterVerified(0))
    expect(result.state).toBe('expired-source-changed')
    expect(result.requiresReverification).toBe(true)
  })

  // @UT-AC-CORE-115@ (FROM: @IMP-AC-CORE-005@)
  it('matches the LATEST weighing report by validFrom, regardless of array order', () => {
    // Sign-off (SOURCE_DATE) is bound to the newest report; an older sibling
    // must not "win". Both orderings must resolve to the newest report — if the
    // evaluator naively took the first element, the [older, newer] case below
    // would pick 2020-01-01 ≠ SOURCE_DATE and report expired-source-changed.
    const latestFirst = evaluateVerificationFreshness(
      profile({
        weighingReports: [{ validFrom: SOURCE_DATE }, { validFrom: '2020-01-01' }],
      }),
      daysAfterVerified(0),
    )
    expect(latestFirst.state).toBe('fresh')

    const olderFirst = evaluateVerificationFreshness(
      profile({
        weighingReports: [{ validFrom: '2020-01-01' }, { validFrom: SOURCE_DATE }],
      }),
      daysAfterVerified(0),
    )
    expect(olderFirst.state).toBe('fresh')
  })
})
