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

export function checkAirportSourceTransitions(value: unknown, previousDate: string, checkDate: string) {
  if (previousDate > checkDate) return { status: 'invalid' } as const
  const before = scanAirportSources(value, previousDate)
  const after = scanAirportSources(value, checkDate)
  if (before.status !== 'scanned' || after.status !== 'scanned' ||
      before.records.some(record => record.status !== 'valid') || after.records.some(record => record.status !== 'valid')) return { status: 'invalid' } as const

  const transitions = after.records.flatMap((record, index) => {
    const previous = before.records[index]
    if (record.status !== 'valid' || previous?.status !== 'valid' || record.temporalStatus === previous.temporalStatus) return []
    return [{ previousStatus: previous.temporalStatus, record }]
  })
  return { status: 'checked', transitions } as const
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

export function compareAirportSourceBatches(previous: unknown, incoming: unknown, checkDate: string) {
  const before = scanAirportSources(previous, checkDate)
  const after = scanAirportSources(incoming, checkDate)
  if (before.status !== 'scanned' || after.status !== 'scanned' ||
      before.records.some(record => record.status !== 'valid') || after.records.some(record => record.status !== 'valid')) return { status: 'invalid' } as const

  const identity = (source: z.infer<typeof AirportSourceRecordSchema>) => JSON.stringify([source.provider, source.dataset, source.recordId, source.jurisdiction, source.aerodrome, source.runway])
  const oldRecords = before.records.flatMap(record => record.status === 'valid' ? [record.source] : [])
  const newRecords = after.records.flatMap(record => record.status === 'valid' ? [record.source] : [])
  const oldById = new Map(oldRecords.map(source => [identity(source), source]))
  const newById = new Map(newRecords.map(source => [identity(source), source]))
  if (oldById.size !== oldRecords.length || newById.size !== newRecords.length) return { status: 'ambiguous' } as const

  const added = after.records.filter(record => record.status === 'valid' && !oldById.has(identity(record.source)))
  const removed = oldRecords.filter(source => !newById.has(identity(source)))
  const changed = newRecords.flatMap(source => {
    const old = oldById.get(identity(source))
    if (!old) return []
    const comparison = compareAirportSource(old, source, checkDate)
    return comparison.status === 'compared' && comparison.changed.length ? [comparison] : []
  })
  return { status: 'compared', added, removed, changed } as const
}

export function compareAirportSourceSnapshots(previous: unknown, incoming: unknown, previousDate: string, checkDate: string) {
  if (previousDate > checkDate) return { status: 'invalid' } as const
  const comparison = compareAirportSourceBatches(previous, incoming, checkDate)
  const before = scanAirportSources(previous, previousDate)
  if (comparison.status !== 'compared') return comparison
  if (before.status !== 'scanned' || before.records.some(record => record.status !== 'valid')) return { status: 'invalid' } as const
  const after = scanAirportSources(incoming, checkDate)
  if (after.status !== 'scanned') return { status: 'invalid' } as const
  const transitions = after.records.flatMap(record => {
    if (record.status !== 'valid') return []
    const old = before.records.find(item => item.status === 'valid' &&
      item.source.provider === record.source.provider && item.source.dataset === record.source.dataset &&
      item.source.recordId === record.source.recordId && item.source.jurisdiction === record.source.jurisdiction &&
      item.source.aerodrome === record.source.aerodrome && item.source.runway === record.source.runway)
    if (!old || old.status !== 'valid' || old.temporalStatus === record.temporalStatus) return []
    return [{ previousStatus: old.temporalStatus, record }]
  })
  return { ...comparison, transitions } as const
}

const AIRPORT_SOURCE_ENVELOPE_VERSION = 1

// Retrieval time is separate from source publication/effect and local saving.
export function packAirportSource(value: unknown, retrievedAt: string) {
  const parsed = AirportSourceRecordSchema.safeParse(value)
  if (!parsed.success || !z.iso.datetime().safeParse(retrievedAt).success) return { status: 'invalid' } as const
  return { status: 'packed', envelope: { schemaVersion: AIRPORT_SOURCE_ENVELOPE_VERSION, retrievedAt, source: parsed.data } } as const
}

// Stored verification and temporal status are never trusted: both are recomputed,
// so a restored record starts unverified and cannot carry stale freshness claims.
export function restoreAirportSource(value: unknown, checkDate: string) {
  const envelope = z.object({ schemaVersion: z.number().int(), retrievedAt: z.iso.datetime(), source: z.unknown() }).loose().safeParse(value)
  if (!envelope.success) return { status: 'invalid' } as const
  if (envelope.data.schemaVersion !== AIRPORT_SOURCE_ENVELOPE_VERSION) return { status: 'unsupported-version' } as const
  const ingested = ingestAirportSource(envelope.data.source, checkDate)
  if (ingested.status !== 'valid') return { status: 'invalid' } as const
  return { ...ingested, status: 'restored', retrievedAt: envelope.data.retrievedAt } as const
}
