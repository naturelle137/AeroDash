import { z } from 'zod'
import { LENGTH_UNITS } from '../logic/unit-preferences'
import { QNH_UNITS } from '../logic/pressure-altitude'

/**
 * Per-aircraft draft of the fuel and performance inputs of a flight preparation.
 *
 * Only what the pilot typed or selected is stored, as the same raw text the
 * forms hold, so restored values pass through the normal input validation.
 * Acknowledgements (extrapolation, disclaimer, manual-configuration choice)
 * and every computed result are deliberately absent.
 */
export const CURRENT_FLIGHTPREP_DRAFT_VERSION = 1 as const

const text = z.string().max(40)
const operation = <T extends z.ZodRawShape>(shape: T) => z.object({ takeoff: z.object(shape), landing: z.object(shape) })

export const FlightPrepDraftSchema = z.object({
  aircraftId: z.string().min(1),
  savedAt: z.string().datetime(),
  fuel: z.object({
    method: z.enum(['', 'duration', 'direct']),
    sequence: text,
    directTripFuel: text,
    consumption: text,
    trip: text,
    reserve: text,
  }),
  performance: z.object({
    temperature: text,
    pressureAltitude: z.object({
      method: z.enum(['', 'direct', 'qnh-elevation']),
      direct: text,
      qnh: text,
      qnhUnit: z.enum(QNH_UNITS),
      elevation: text,
      elevationUnit: z.enum(LENGTH_UNITS),
    }),
    corrections: operation({ headwind: text, slope: text }),
    safetyFactors: operation({
      preset: z.enum(['poh-afm', 'easa-standard', 'short-field', 'custom']),
      custom: text,
    }),
    obstacle: z.object({
      height: text,
      heightUnit: z.enum(['ft', 'm']),
      distance: text,
      distanceUnit: z.enum(['ft', 'm']),
    }),
  }),
})

export type FlightPrepDraft = z.infer<typeof FlightPrepDraftSchema>

/** Stored container; entries are validated one by one so one bad aircraft cannot hide the others. */
export const FlightPrepDraftStoreSchema = z.object({
  version: z.literal(CURRENT_FLIGHTPREP_DRAFT_VERSION),
  drafts: z.record(z.string(), z.unknown()),
})
