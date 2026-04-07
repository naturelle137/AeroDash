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
 * @see docs/architecture/frontend_state_machine.md
 */

// @IMP-SYS-CORE-005@ (FROM: @REQ-SYS-014@)

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
 * future milestone. A schema mismatch (wrong version or Zod parse failure)
 * results in a clean session — no partial or stale data enters the app.
 */
export const SessionPayloadSchema = z.object({
  /** Schema version — currently 1. */
  version: z.literal(1),
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
