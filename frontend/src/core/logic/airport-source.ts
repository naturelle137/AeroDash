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

export function scanAirportSources(value: unknown, checkDate: string) {
  if (!Array.isArray(value) || value.length === 0 || !z.iso.date().safeParse(checkDate).success) {
    return { status: 'invalid' } as const
  }

  const records = value.map(record => ingestAirportSource(record, checkDate))
  return { status: 'scanned', records } as const
}

export function selectAirportSource(value: unknown, aerodrome: string, runway: string, checkDate: string) {
  if (!text.safeParse(aerodrome).success || !text.safeParse(runway).success) return { status: 'invalid' } as const
  const scan = scanAirportSources(value, checkDate)
  if (scan.status === 'invalid' || scan.records.some(record => record.status === 'invalid')) return { status: 'invalid' } as const
  const matches = scan.records.filter(record => record.status === 'valid' && record.source.aerodrome === aerodrome && record.source.runway === runway)
  if (matches.length === 0) return { status: 'not-found' } as const
  if (matches.length > 1) return { status: 'ambiguous' } as const
  return { status: 'selected', record: matches[0] } as const
}

export function compareAirportSource(previous: unknown, incoming: unknown, checkDate: string) {
  const before = ingestAirportSource(previous, checkDate)
  const after = ingestAirportSource(incoming, checkDate)
  if (before.status !== 'valid' || after.status !== 'valid') return { status: 'invalid' } as const

  const identity = ['provider', 'dataset', 'recordId', 'jurisdiction', 'aerodrome', 'runway'] as const
  if (identity.some(key => before.source[key] !== after.source[key])) return { status: 'different-record' } as const

  const fields = ['version', 'publicationDate', 'effectiveDate', 'expiryDate', 'superseded', 'restrictionCoverage', 'tora', 'lda'] as const
  const changed = fields.filter(key => JSON.stringify(before.source[key]) !== JSON.stringify(after.source[key]))
  return { status: 'compared', changed, incoming: after } as const
}
