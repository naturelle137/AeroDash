/**
 * App Version SemVer helper — shared between the store, cache, and remote
 * legs of the REQ-SYS-006 / H-019 enforcement gate (issue #271).
 *
 * Implements a strict-enough subset of SemVer 2.0.0 ordering rules so the
 * kill-switch comparator cannot silently NaN-collapse on `+build` metadata
 * or mis-order pre-release identifiers.
 *
 * The previous comparator did `v.replace(/-.*$/, '').split('.').map(Number)`
 * which had two latent defects called out in the PR review:
 *
 * 1. **Build metadata (`+build.7`) was not stripped** — `parseInt('0+build')`
 *    is `NaN`, so `cPat < mPat` became `0 < NaN` → `false` and a higher
 *    cached / remote floor silently failed to block.
 * 2. **Pre-release suffixes were stripped, not ordered** — `isVersionBelow(
 *    '0.4.0-alpha', '0.4.0')` returned `false`, but SemVer requires
 *    `0.4.0-alpha < 0.4.0`. An alpha bundle below its stable kill-switch
 *    floor would keep flying.
 *
 * This module fixes both: build metadata is ignored for ordering (SemVer
 * §10), and pre-release identifiers are compared per SemVer §11. The parser
 * **throws** on malformed input so {@link pickHigherVersion}'s defensive
 * catch path can actually catch — the previous comparator silently returned
 * `false` on NaN, indistinguishable from a valid "current ≥ minimum"
 * result.
 */

// @IMP-SYS-SHARED-010@ (FROM: @REQ-SYS-006@, @H-019@)

import { createLogger } from '@/shared/utils/logger'

const logger = createLogger('AppVersionSemVer')

/**
 * SemVer 2.0.0 grammar fragments, composed once into both the shape-guard
 * ({@link SEMVER_RE}) and the parser ({@link SEMVER_PARSE_RE}).
 *
 * Composing both regexes from the SAME fragments is deliberate: the previous
 * code had a `[-+]`-only shape-guard that accepted only ONE of pre-release /
 * build while the parser accepted both, so a legal `1.2.3-rc.1+sha` failed the
 * guard and a build-time floor carrying both could be silently demoted
 * (PR-review Major #1). Deriving both from one source makes that drift
 * impossible.
 *
 * The pre-release grammar is the strict SemVer §9 form — numeric identifiers
 * carry no leading zeros and identifiers are non-empty — so `0.1.2-01`
 * (would compare as numeric `1`, conflating two distinct floors) and
 * `0.1.2-foo..bar` (empty identifier sorts as alphanumeric-lowest) are
 * rejected up front rather than mis-ordered (PR-review Nit #3).
 *
 * `MAJOR.MINOR.PATCH` is left as `\d+` (leading zeros tolerated) — pragmatic
 * for an app whose own version components are always small.
 */
const PRERELEASE_ID = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)'
const PRERELEASE = `${PRERELEASE_ID}(?:\\.${PRERELEASE_ID})*`
const BUILD = '[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*'
const CORE = '\\d+\\.\\d+\\.\\d+'

/**
 * Strict SemVer guard — `MAJOR.MINOR.PATCH` with an optional pre-release
 * AND/OR build suffix. Anchored. Shared by the cache and remote shape-guards.
 */
export const SEMVER_RE = new RegExp(`^${CORE}(?:-${PRERELEASE})?(?:\\+${BUILD})?$`)

/** Capturing variant of {@link SEMVER_RE} — `[, major, minor, patch, pre]`. */
const SEMVER_PARSE_RE = new RegExp(
  `^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(${PRERELEASE}))?(?:\\+${BUILD})?$`,
)

/** True when `v` is a structurally-valid SemVer string per {@link SEMVER_RE}. */
export function isValidSemVer(v: unknown): v is string {
  return typeof v === 'string' && SEMVER_RE.test(v)
}

/** Parsed SemVer parts. Build metadata is dropped (ignored for ordering, SemVer §10). */
interface SemVerParts {
  readonly major: number
  readonly minor: number
  readonly patch: number
  /** Dot-separated pre-release identifiers, or `[]` for a release (no pre-release). */
  readonly pre: readonly string[]
}

/**
 * Parse a SemVer string into its ordering-relevant parts.
 *
 * @throws RangeError when `v` does not match {@link SEMVER_RE} or any
 *   numeric component is not finite. The caller is responsible for
 *   guarding with {@link isValidSemVer} when invalid input is expected.
 */
export function parseSemVer(v: string): SemVerParts {
  if (typeof v !== 'string') {
    throw new RangeError(`SemVer parse: not a string`)
  }
  const m = SEMVER_PARSE_RE.exec(v)
  if (!m) throw new RangeError(`SemVer parse: invalid input "${v}"`)
  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    throw new RangeError(`SemVer parse: non-finite numeric component in "${v}"`)
  }
  const pre = m[4] ? m[4].split('.') : []
  return { major, minor, patch, pre }
}

/** Compare two pre-release identifier arrays per SemVer §11.4. Returns `-1 | 0 | 1`. */
function comparePreRelease(a: readonly string[], b: readonly string[]): number {
  // §11.3: a version *without* a pre-release has higher precedence than one *with* one.
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const ai = a[i] as string
    const bi = b[i] as string
    const aIsNum = /^\d+$/.test(ai)
    const bIsNum = /^\d+$/.test(bi)
    if (aIsNum && bIsNum) {
      // §11.4.1 — numeric identifiers compared numerically.
      const an = Number(ai)
      const bn = Number(bi)
      if (an !== bn) return an < bn ? -1 : 1
    } else if (aIsNum && !bIsNum) {
      // §11.4.3 — numeric identifiers always have lower precedence than alphanumeric.
      return -1
    } else if (!aIsNum && bIsNum) {
      return 1
    } else {
      // §11.4.2 — alphanumeric identifiers compared lexically in ASCII order.
      if (ai < bi) return -1
      if (ai > bi) return 1
    }
  }
  // §11.4.4 — a larger set of pre-release fields has higher precedence.
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  return 0
}

/**
 * `true` when `current < minimum` per SemVer §11 ordering.
 *
 * Build metadata is ignored. Pre-release identifiers are ordered correctly
 * (numeric < alphanumeric; longer pre-release > shorter; release > any
 * pre-release of the same `MAJOR.MINOR.PATCH`).
 *
 * @throws RangeError if either argument is not a valid SemVer string.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  const c = parseSemVer(current)
  const m = parseSemVer(minimum)
  if (c.major !== m.major) return c.major < m.major
  if (c.minor !== m.minor) return c.minor < m.minor
  if (c.patch !== m.patch) return c.patch < m.patch
  return comparePreRelease(c.pre, m.pre) < 0
}

/**
 * Return whichever of `a` / `b` is the higher SemVer per {@link isVersionBelow}.
 *
 * Defensive against invalid input: if one operand fails {@link isValidSemVer}
 * but the other passes, the valid one is returned. If both are invalid `a`
 * is returned. This is the only path that does not throw — the caller's
 * upstream (cache shape-guard, remote shape-guard, build-time validation in
 * the store) should already have rejected malformed values; the catch here
 * is a belt-and-braces for the case where one slips through.
 */
export function pickHigherVersion(a: string, b: string): string {
  const aValid = isValidSemVer(a)
  const bValid = isValidSemVer(b)
  if (!aValid && !bValid) {
    // Unreachable given upstream shape-guards (cache, remote) and the store's
    // build-time validation, but surface it loudly if a future code path ever
    // slips two invalid operands through (PR-review Nit #4) — silently
    // returning `a` would otherwise hide the double-invalid state indefinitely.
    logger.error('pickHigherVersion received two invalid SemVer operands; returning the first', {
      code: 'MIN_SAFE_VERSION_PICK_BOTH_INVALID',
    })
    return a
  }
  if (!aValid) return b
  if (!bValid) return a
  return isVersionBelow(a, b) ? b : a
}
