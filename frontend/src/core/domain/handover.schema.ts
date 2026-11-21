import { z } from 'zod'
import { FlightPrepDraftSchema } from './flightprep-draft.schema'

/**
 * Editable, unsigned exchange file for one flight preparation.
 *
 * It carries only the entries a student typed. It has no approval, signature
 * or reviewer field and the schema is strict, so a file that adds one is
 * rejected rather than shown as reviewed. Per-station `verified` flags are
 * deliberately absent: the receiver must verify every value themselves.
 */
export const HANDOVER_FORMAT = 'aerodash-flightprep-handover' as const
export const CURRENT_HANDOVER_VERSION = 1 as const
export const MAX_HANDOVER_BYTES = 256 * 1024

export const HandoverFileSchema = z.object({
  format: z.literal(HANDOVER_FORMAT),
  version: z.literal(CURRENT_HANDOVER_VERSION),
  exportedAt: z.string().datetime(),
  review: z.literal('unreviewed'),
  aircraft: z.object({ registration: z.string().min(1).max(20) }).strict(),
  massBalance: z.object({
    activeCategory: z.string().min(1).max(100),
    stations: z.array(z.object({
      name: z.string().max(100),
      weight: z.number().nonnegative().max(1_000_000),
      touched: z.boolean(),
    }).strict()).max(50),
  }).strict(),
  entries: FlightPrepDraftSchema.pick({ fuel: true, performance: true }).strict(),
}).strict()

export type HandoverFile = z.infer<typeof HandoverFileSchema>
