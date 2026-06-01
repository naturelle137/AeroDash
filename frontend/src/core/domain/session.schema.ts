import { z } from 'zod'

/**
 * Zod schema for the persisted session payload.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * The session payload captures the pilot's entered preflight data so it
 * can survive browser refreshes and be restored on next page load.
 * Restored data is validated against this schema before entering any
 * computation pipeline.
 *
 * The companion migration table lives in `./session-migrations.ts` and
 * forwards older serialised payloads to {@link SessionPayloadSchema}.
 * A payload whose `version` is newer than the running build can read
 * (PWA-cache rollback) is *dropped* with an INFO notification — never
 * silently truncated.
 *
 * @see docs/architecture/frontend_state_machine.md
 */

// @IMP-SYS-CORE-009@ (FROM: @REQ-SYS-013@)

/**
 * Current session-payload schema version.
 *
 * Bump in lockstep with `SessionPayloadSchema.version` (also a `z.literal`)
 * and with the migration table in `./session-migrations.ts`. The literal
 * keeps Zod's runtime guard aligned with the migration registry's compile-
 * time guarantees — a payload that survives migration is, by construction,
 * at the current version.
 */
export const CURRENT_SESSION_PAYLOAD_VERSION = 1 as const

/** One station's serialisable state — weight and interaction flags only. */
export const StationPayloadSchema = z.object({
  /** Index into the AircraftContext.loadPoints array. */
  index: z.number().int().nonnegative(),
  /** Last weight value entered by the pilot (source unit, not normalised). */
  weight: z.number().nonnegative(),
  /** Whether the pilot has interacted with this field. */
  touched: z.boolean(),
  /** Whether the pilot has explicitly verified this field. */
  verified: z.boolean(),
})

/**
 * Full session payload stored in `localStorage`.
 *
 * `version` enables forward-compatible migration if the schema changes in a
 * future milestone. Older payloads pass through the migration table; newer
 * payloads (PWA-cache rollback after a forward bump) are dropped with an
 * INFO notification rather than silently truncated. Outright corruption
 * (parse failure, missing fields) results in a clean session.
 */
export const SessionPayloadSchema = z.object({
  /** Schema version of the *current* runtime — migration target. */
  version: z.literal(CURRENT_SESSION_PAYLOAD_VERSION),
  /** UUID of the active AircraftProfile at time of save. */
  aircraftId: z.string().min(1),
  /** Active certification category key (e.g. "Normal"). */
  activeCategory: z.string().min(1),
  /** Per-station snapshots (one entry per available load station). */
  stations: z.array(StationPayloadSchema),
  /** ISO-8601 timestamp when the payload was serialised. */
  savedAt: z.string().datetime(),
})

export type StationPayload = z.infer<typeof StationPayloadSchema>
export type SessionPayload = z.infer<typeof SessionPayloadSchema>
