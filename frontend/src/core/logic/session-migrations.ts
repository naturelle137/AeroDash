/**
 * Session payload migration registry.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Resilience model for the `aerodash:session:payload` localStorage value:
 *
 *  - Migration walks per-version up-functions starting from the stored
 *    `version` (or `0` when the field is missing / non-numeric / corrupt).
 *  - When the stored version is *newer* than this build's
 *    {@link CURRENT_SESSION_PAYLOAD_VERSION} — a PWA-cache rollback after
 *    a forward bump — the payload is reported as
 *    `unsupported-future-version`. Callers MUST drop it and surface an
 *    INFO notification to the pilot.
 *  - Parse failure, malformed JSON-tree shapes, and Zod validation failure
 *    surface as `corrupt`. Callers clear storage and start a clean session.
 *
 * @see frontend/src/core/domain/session.schema.ts
 */

// @IMP-SYS-CORE-012@ (FROM: @REQ-SYS-013@)

import {
  CURRENT_SESSION_PAYLOAD_VERSION,
  SessionPayloadSchema,
  type SessionPayload,
} from '../domain/session.schema'

/** Up-function: transform a session payload from version `n` to `n + 1`. */
export type SessionMigration = (payload: Record<string, unknown>) => Record<string, unknown>

/**
 * Per-version up-functions keyed by the *source* version. Adding migration
 * `n → n+1` requires:
 *   1. Bumping {@link CURRENT_SESSION_PAYLOAD_VERSION} in `session.schema.ts`.
 *   2. Registering `n` here with a pure transform.
 *   3. Updating {@link SessionPayloadSchema} to the new shape.
 *
 * The current registry contains the `0 → 1` stamping migration so payloads
 * persisted by a hypothetical pre-versioned build can be forward-stamped
 * rather than dropped. No structural transformations are applied because
 * the v1 shape is the inaugural shipped shape.
 */
const migrations: ReadonlyMap<number, SessionMigration> = new Map<number, SessionMigration>([
  [
    0,
    /**
     * v0 → v1: stamp the `version` field on hypothetical pre-versioned
     * payloads. No structural transformation is applied; v0 is treated as
     * a legacy alias of v1.
     */
    (payload) => ({ ...payload, version: 1 }),
  ],
])

/** Outcome of a single migration attempt. */
export type SessionMigrationOutcome =
  | {
      readonly kind: 'migrated'
      readonly payload: SessionPayload
      /** Source versions whose up-functions actually ran. */
      readonly versionsApplied: readonly number[]
    }
  | {
      readonly kind: 'unsupported-future-version'
      readonly storedVersion: number
    }
  | {
      readonly kind: 'corrupt'
      readonly storedVersion: number
      readonly reason: string
    }

function readStoredVersion(payload: Record<string, unknown>): number {
  const raw = payload['version']
  if (typeof raw !== 'number') return 0
  if (!Number.isFinite(raw)) return 0
  if (!Number.isInteger(raw)) return 0
  if (raw < 0) return 0
  return raw
}

/**
 * Walk a raw payload through a supplied migration registry up to
 * `currentVersion`. Pure, parameterised version of {@link migrateSessionPayload}
 * — extracted so the defensive branches (missing-step and throwing-up-function)
 * are reachable from tests with a synthetic registry. The production wrapper
 * {@link migrateSessionPayload} passes the module-private registry and
 * {@link CURRENT_SESSION_PAYLOAD_VERSION} and remains the only entry point
 * callers should use.
 */
export function runSessionMigrationWalker(
  raw: unknown,
  registry: ReadonlyMap<number, SessionMigration>,
  currentVersion: number,
): SessionMigrationOutcome {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'corrupt', storedVersion: 0, reason: 'payload is not an object' }
  }

  const payload = raw as Record<string, unknown>
  const storedVersion = readStoredVersion(payload)

  if (storedVersion > currentVersion) {
    return { kind: 'unsupported-future-version', storedVersion }
  }

  let working: Record<string, unknown> = { ...payload }
  const versionsApplied: number[] = []

  for (let v = storedVersion; v < currentVersion; v++) {
    const step = registry.get(v)
    if (!step) {
      return {
        kind: 'corrupt',
        storedVersion,
        reason: `no migration registered for source version ${v}`,
      }
    }
    try {
      working = step(working)
    } catch (err) {
      return {
        kind: 'corrupt',
        storedVersion,
        reason: `migration ${v} → ${v + 1} threw: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    versionsApplied.push(v)
  }

  const parsed = SessionPayloadSchema.safeParse(working)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    return { kind: 'corrupt', storedVersion, reason: `schema validation failed: ${issues}` }
  }

  return { kind: 'migrated', payload: parsed.data, versionsApplied }
}

/**
 * Migrate a raw, localStorage-shaped payload up to the current schema version.
 *
 * `raw` is treated defensively — null, undefined, non-objects, and arrays
 * report `corrupt`. Each up-function is wrapped in a try/catch so a single
 * throwing transform cannot escape the boundary (matches the
 * fleet-store partial-migration crash-recovery guarantee).
 */
export function migrateSessionPayload(raw: unknown): SessionMigrationOutcome {
  return runSessionMigrationWalker(raw, migrations, CURRENT_SESSION_PAYLOAD_VERSION)
}
