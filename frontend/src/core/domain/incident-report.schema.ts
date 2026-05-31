import { z } from 'zod'

/**
 * Zod schemas for the in-app incident-reporting MVP (issue #281, PR-006).
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * The incident channel is the first formal feedback loop from real (pilot-
 * trial) users back into the regression suite: a redacted report queued
 * offline → opened on GitHub by the pilot when connectivity returns →
 * triaged into a `Bug`/`Feature` issue → pinned in regression tests once
 * fixed.
 *
 * Privacy contract: every field captured here is either app-controlled
 * metadata (build version, route name, kind) or pilot-supplied free text
 * that has already been routed through {@link incident-redaction}. The
 * schema itself is unaware of the redactor — it only validates the shape
 * of the persisted document.
 *
 * @see docs/development/incident-to-regression.md
 */

// @IMP-SYS-CORE-013@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@)

/**
 * Coarse-grained taxonomy for the pilot to self-classify the report. Kept
 * intentionally small so triage is fast and the enum can be reused as the
 * GitHub issue-template dropdown without lossy mapping.
 */
export const IncidentKindSchema = z.enum([
  'CALCULATION', // Mass & Balance / Performance / Fuel & Endurance result looked wrong
  'DATA', // Aircraft profile / airport data appeared incorrect
  'UI', // Layout, input, or display defect
  'CRASH', // The app or a page failed to load / froze
  'OTHER',
])
export type IncidentKind = z.infer<typeof IncidentKindSchema>

/**
 * Per-tab build metadata snapshot attached to every report. All fields are
 * app-controlled (no pilot input) so they are safe to round-trip into the
 * pre-filled GitHub issue body without further redaction.
 */
export const IncidentContextSchema = z.object({
  appVersion: z.string().max(64),
  /** Vue Router route name at capture time, or `null` if unknown. */
  routeName: z.string().max(64).nullable(),
  /** Last segment of the URL pathname (no query / hash) at capture time. */
  pathTail: z.string().max(128).nullable(),
  /** `navigator.userAgent` slice, capped to avoid log bloat. */
  userAgent: z.string().max(256).nullable(),
  /** Web Locks / Service Worker / online flag at capture time. */
  online: z.boolean().nullable(),
})
export type IncidentContext = z.infer<typeof IncidentContextSchema>

/** Hard ceilings for free-text fields — prevents log bloat and URL overflow. */
export const SUMMARY_MAX_LEN = 120
export const DESCRIPTION_MAX_LEN = 4_000

/**
 * What the UI form submits BEFORE redaction. Validated at the boundary so
 * a malformed draft never reaches the redactor or the queue.
 */
export const IncidentDraftSchema = z.object({
  kind: IncidentKindSchema,
  summary: z.string().min(3).max(SUMMARY_MAX_LEN),
  description: z.string().min(10).max(DESCRIPTION_MAX_LEN),
})
export type IncidentDraft = z.infer<typeof IncidentDraftSchema>

/**
 * The persisted, redacted, fully-formed report. `summary` and
 * `redactedDescription` have already passed through the redactor; storing
 * the original pilot text is intentionally NOT supported (privacy by design).
 */
export const IncidentReportSchema = z.object({
  /** UUID v4. */
  id: z.string().uuid(),
  /** ISO-8601 UTC timestamp the pilot captured the report. */
  createdAt: z.string().datetime(),
  kind: IncidentKindSchema,
  summary: z.string().min(3).max(SUMMARY_MAX_LEN),
  redactedDescription: z.string().min(1).max(DESCRIPTION_MAX_LEN),
  context: IncidentContextSchema,
  /**
   * Bumped when the persisted shape changes incompatibly. The queue
   * repository drops rows whose version is from a future build (PWA
   * rollback safety, mirrors the fleet repository contract).
   */
  schemaVersion: z.literal(1),
})
export type IncidentReport = z.infer<typeof IncidentReportSchema>
