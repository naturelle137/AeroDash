import { z } from 'zod'
import { runwayFreshness } from './manual-runway'

const text = z.string().min(1).max(200).refine(value => value.trim().length > 0)
const distance = z.object({ value: z.number().positive().finite(), unit: z.enum(['m', 'ft']) }).strict()

// This interchange contract does not establish that any provider is eligible.
const AirportSourceRecordSchema = z.object({
  provider: text,
  dataset: text,
  version: text,
  recordId: text,
  jurisdiction: text,
  aerodrome: text,
  runway: text,
  publicationDate: z.iso.date().nullable(),
  effectiveDate: z.iso.date().nullable(),
  expiryDate: z.iso.date().nullable(),
  superseded: z.boolean().nullable(),
  restrictionCoverage: z.string().min(1).max(200).refine(value => value.trim().length > 0).nullable(),
  tora: distance.nullable(),
  lda: distance.nullable(),
}).strict().refine(record => !record.effectiveDate || !record.expiryDate || record.effectiveDate <= record.expiryDate)

export function ingestAirportSource(value: unknown, checkDate: string) {
  const parsed = AirportSourceRecordSchema.safeParse(value)
  if (!parsed.success || !z.iso.date().safeParse(checkDate).success) return { status: 'invalid' } as const
  const source = parsed.data
  const dateStatus = runwayFreshness({ effectiveDate: source.effectiveDate ?? undefined, expiryDate: source.expiryDate ?? undefined }, checkDate)
  const temporalStatus = source.superseded === true ? 'superseded' : dateStatus
  return {
    status: 'valid', source, temporalStatus,
    verification: { tora: source.tora ? 'unverified' : 'unknown', lda: source.lda ? 'unverified' : 'unknown' },
  } as const
}
