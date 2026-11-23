import { flightPrepUnits } from '@/modules/export/flight-prep-json'
import { exportAllProfiles } from '@/modules/aircraft/services/data-rights.service'
import { FlightPrepDraftSchema, FlightPrepDraftStoreSchema } from '@/core/domain/flightprep-draft.schema'
import { migrateSessionPayload } from '@/core/logic/session-migrations'
import { recoverManualRunwayRecord } from '@/core/logic/manual-runway'
import { parseSourceUnit } from '@/core/logic/unit-normalization'
import { MANUAL_RUNWAY_STORAGE_KEY } from '@/modules/airport/services/manual-runway.repository'
import { RECENT_AIRPORTS_KEY } from '@/modules/airport/services/recent-airports.repository'
import { STORAGE_KEY, parseStored } from '@/modules/annotations/annotations'
import type { SessionPayload } from '@/core/domain/session.schema'
import type { FlightPrepDraft } from '@/core/domain/flightprep-draft.schema'

export async function exportPersonalData() {
  const fleet = await exportAllProfiles()
  const omissions: string[] = fleet.omitted.map(() => 'Unreadable aircraft profile')
  const sessions: (Omit<SessionPayload, 'stations'> & { stations: (SessionPayload['stations'][number] & { unit: string | null })[] })[] = []
  const drafts: FlightPrepDraft[] = []
  function read(key: string): unknown {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? undefined : JSON.parse(raw) as unknown
    } catch {
      omissions.push(`${key}: unavailable or unreadable`)
      return undefined
    }
  }
  function session(value: unknown, key: string, id?: string) {
    const result = migrateSessionPayload(value)
    if (result.kind !== 'migrated' || (id !== undefined && result.payload.aircraftId !== id)) {
      omissions.push(`${key}: unreadable session`)
      return
    }
    const profile = fleet.envelope.profiles.find(p => p.id === result.payload.aircraftId)
    const stations = result.payload.stations.map(station => {
      const point = profile?.loadPoints[station.index]
      const source = profile?.sourceUnit.trim().toLowerCase() ?? ''
      const unit = point?.unit || (point && /^(kg|lb)(-(m|ft|in))?$/.test(source) ? parseSourceUnit(source).massUnit : null)
      if (!unit) omissions.push(`${key}: station ${station.index} unit unavailable`)
      return { ...station, unit }
    })
    sessions.push({ ...result.payload, stations })
  }
  const active = read('aerodash:session:payload')
  if (active !== undefined) session(active, 'active session')
  const stash = read('aerodash:session:by-aircraft')
  if (stash !== undefined) {
    if (typeof stash === 'object' && stash !== null && !Array.isArray(stash)) {
      for (const [id, value] of Object.entries(stash)) session(value, `session ${id}`, id)
    } else omissions.push('Per-aircraft sessions: unreadable store')
  }
  const storedDrafts = read('aerodash:flightprep:draft')
  if (storedDrafts !== undefined) {
    const parsed = FlightPrepDraftStoreSchema.safeParse(storedDrafts)
    if (!parsed.success) omissions.push('Flight preparation drafts: unreadable store')
    else for (const [id, value] of Object.entries(parsed.data.drafts)) {
      const draft = FlightPrepDraftSchema.safeParse(value)
      if (draft.success && draft.data.aircraftId === id) drafts.push(draft.data)
      else omissions.push(`Flight preparation ${id}: unreadable draft`)
    }
  }
  const manual = read(MANUAL_RUNWAY_STORAGE_KEY)
  const recent = read(RECENT_AIRPORTS_KEY)
  function runway(value: unknown, key: string) {
    const result = recoverManualRunwayRecord(JSON.stringify(value))
    if (result.status === 'loaded') return result.record
    omissions.push(`${key}: unreadable runway`)
    return null
  }
  const manualRunway = manual === undefined ? null : runway(manual, 'Manual runway')
  const recentRunways = []
  if (recent !== undefined) {
    if (!Array.isArray(recent)) omissions.push('Recent runways: unreadable store')
    else for (const item of recent) {
      const record = runway(item, 'Recent runway')
      if (record) recentRunways.push(record)
    }
  }
  const storedNotes = read(STORAGE_KEY)
  let notes: ReturnType<typeof parseStored> = []
  if (storedNotes !== undefined) {
    if (!Array.isArray(storedNotes)) omissions.push('Notes: unreadable store')
    else {
      notes = parseStored(JSON.stringify(storedNotes))
      if (notes.length !== storedNotes.length) omissions.push('Notes: unreadable entries')
    }
  }
  const units = flightPrepUnits
  return { format: 'aerodash-personal-data', version: 1, exportedAt: fleet.envelope.exportedAt, fleet: fleet.envelope, sessions, drafts, units, manualRunway, recentRunways, notes, omissions, complete: omissions.length === 0 }
}
