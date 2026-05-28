/**
 * Profile verification freshness — P1 Safety Core.
 *
 * A "Verified" aircraft profile carries a human sign-off (REQ-AC-007): who
 * attested it, against which POH revision, and which weighing report was the
 * source of truth at the time. That attestation does not stay true forever:
 *
 *  - It **ages out.** A sign-off made long ago no longer evidences that the
 *    data still matches the current POH/AFM. After a fixed validity window the
 *    verification is treated as expired and the profile must be re-verified.
 *  - It is **invalidated when its source changes.** If the profile's active
 *    weighing report no longer matches the one the sign-off was bound to, the
 *    attestation is about data that no longer exists. This is a defence-in-depth
 *    check against an imported/tampered exchange file that claims `verified`
 *    while carrying a mismatched weighing report — the in-app edit flow already
 *    drops a Verified profile back to Draft, but an external document can pair
 *    any status with any data.
 *
 * An expired or source-changed verification is a Garbage-In gate failure
 * (H-011): the profile must not be trusted as a verified source for a Go/No-Go
 * advisory until a fresh sign-off is recorded.
 *
 * Pure, deterministic, side-effect free. `now` is injected so the result is a
 * function of its inputs only — callers pass `new Date()`, tests pass a fixed
 * instant. Calendar arithmetic is performed in whole UTC days: provenance dates
 * are calendar dates ('YYYY-MM-DD'), not timestamps.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-007
 * @see docs/risk_management/safety_hazards.md H-011
 */

import type { AircraftProfileVerification } from '../adapters/aircraft.schema'

// @IMP-AC-CORE-005@ (FROM: @REQ-AC-007@)

/**
 * Validity window for a verification sign-off, in days. Fixed constant — not
 * user-configurable, so a pilot cannot extend the trust horizon of stale data.
 * 90 days mirrors a common pre-season / quarterly POH-data review cadence.
 */
export const VERIFICATION_VALIDITY_DAYS = 90

const DAY_MS = 86_400_000
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type VerificationFreshnessState =
  /** Profile is a working Draft — provenance/expiry do not apply (WARN-AC-002 owns this). */
  | 'draft'
  /** Verified at rest but with no recorded provenance (legacy / pre-REQ-AC-007 / import). */
  | 'verified-unattributed'
  /** Verified with provenance, still inside the validity window and matching its source. */
  | 'fresh'
  /** Verified with provenance, but older than the validity window. */
  | 'expired-aged'
  /** Verified with provenance, but its source weighing report no longer matches the sign-off. */
  | 'expired-source-changed'

export interface VerificationFreshness {
  readonly state: VerificationFreshnessState
  /** True when the profile must NOT be trusted as a verified source for safety-critical use. */
  readonly requiresReverification: boolean
  /** The recorded sign-off, echoed back when present; `null` for Draft / unattributed. */
  readonly provenance: AircraftProfileVerification | null
  /** Computed expiry calendar date ('YYYY-MM-DD'); `null` when not computable. */
  readonly expiresOn: string | null
  /** Whole days until expiry (≤ 0 once expired); `null` when not computable. */
  readonly daysUntilExpiry: number | null
}

/** Minimal profile shape the freshness evaluation needs. */
export interface VerifiableProfile {
  readonly status: 'draft' | 'verified'
  readonly verification?: AircraftProfileVerification
  readonly weighingReports: ReadonlyArray<{ readonly validFrom: string }>
}

/** Parse a 'YYYY-MM-DD' calendar date to its UTC-midnight epoch-day index, or null. */
function toEpochDay(iso: string): number | null {
  if (!ISO_DATE_RE.test(iso)) return null
  const ms = Date.parse(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(ms)) return null
  return Math.floor(ms / DAY_MS)
}

/** Format a UTC epoch-day index back to a 'YYYY-MM-DD' calendar date. */
function fromEpochDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** The active (latest) weighing report's `validFrom`, or null when none exist. */
function activeSourceWeighingDate(
  reports: ReadonlyArray<{ readonly validFrom: string }>,
): string | null {
  let latest: string | null = null
  for (const r of reports) {
    if (latest === null || r.validFrom.localeCompare(latest) > 0) {
      latest = r.validFrom
    }
  }
  return latest
}

/**
 * Evaluate the freshness of a profile's verification at instant `now`.
 *
 * Resolution order (most-specific reason wins):
 *   1. Not verified                 → `draft`
 *   2. Verified, no provenance      → `verified-unattributed`
 *   3. Source weighing report moved → `expired-source-changed`
 *   4. Past the validity window     → `expired-aged`
 *   5. Otherwise                    → `fresh`
 *
 * A `verified-unattributed` profile is intentionally NOT forced to re-verify:
 * legacy/imported Verified records pre-date provenance capture and must not be
 * mass-invalidated. New sign-offs always carry provenance (enforced upstream by
 * the fleet store), so the unattributed state shrinks over time.
 */
export function evaluateVerificationFreshness(
  profile: VerifiableProfile,
  now: Date,
): VerificationFreshness {
  if (profile.status !== 'verified') {
    return {
      state: 'draft',
      requiresReverification: false,
      provenance: null,
      expiresOn: null,
      daysUntilExpiry: null,
    }
  }

  const provenance = profile.verification ?? null
  if (provenance === null) {
    return {
      state: 'verified-unattributed',
      requiresReverification: false,
      provenance: null,
      expiresOn: null,
      daysUntilExpiry: null,
    }
  }

  // Source-change check (defence in depth against tampered/stale imports).
  const currentSource = activeSourceWeighingDate(profile.weighingReports)
  if (currentSource === null || currentSource !== provenance.sourceWeighingDate) {
    return {
      state: 'expired-source-changed',
      requiresReverification: true,
      provenance,
      expiresOn: null,
      daysUntilExpiry: null,
    }
  }

  // Age check. A structurally-valid but unparseable date fails closed (expired).
  const verifiedDay = toEpochDay(provenance.verifiedOn)
  if (verifiedDay === null) {
    return {
      state: 'expired-aged',
      requiresReverification: true,
      provenance,
      expiresOn: null,
      daysUntilExpiry: null,
    }
  }

  const expiryDay = verifiedDay + VERIFICATION_VALIDITY_DAYS
  const nowDay = Math.floor(now.getTime() / DAY_MS)
  const daysUntilExpiry = expiryDay - nowDay
  const expiresOn = fromEpochDay(expiryDay)

  if (daysUntilExpiry <= 0) {
    return {
      state: 'expired-aged',
      requiresReverification: true,
      provenance,
      expiresOn,
      daysUntilExpiry,
    }
  }

  return {
    state: 'fresh',
    requiresReverification: false,
    provenance,
    expiresOn,
    daysUntilExpiry,
  }
}
