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
export const CURRENT_HANDOVER_VERSION = 2 as const
export const MAX_HANDOVER_BYTES = 256 * 1024

const fuel = FlightPrepDraftSchema.shape.fuel.strict()
const performance = FlightPrepDraftSchema.shape.performance
const operation = (schema: typeof performance.shape.corrections) => schema.extend({
  takeoff: schema.shape.takeoff.strict(), landing: schema.shape.landing.strict(),
}).strict()
const handoverPerformance = performance.extend({
  pressureAltitude: performance.shape.pressureAltitude.strict(),
  corrections: operation(performance.shape.corrections),
  safetyFactors: performance.shape.safetyFactors.extend({
    takeoff: performance.shape.safetyFactors.shape.takeoff.strict(),
    landing: performance.shape.safetyFactors.shape.landing.strict(),
  }).strict(),
  obstacle: performance.shape.obstacle.strict(),
}).strict()

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
      unit: z.string().min(1).max(40),
      weight: z.number().nonnegative().max(1_000_000),
      touched: z.boolean(),
    }).strict()).max(50),
  }).strict(),
  entries: z.object({ fuel, performance: handoverPerformance }).strict(),
}).strict()

export type HandoverFile = z.infer<typeof HandoverFileSchema>
