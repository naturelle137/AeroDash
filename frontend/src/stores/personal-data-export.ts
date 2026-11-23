import { exportAllProfiles } from '@/modules/aircraft/services/data-rights.service'
import { FlightPrepDraftSchema, FlightPrepDraftStoreSchema } from '@/core/domain/flightprep-draft.schema'
import { migrateSessionPayload } from '@/core/logic/session-migrations'
import type { SessionPayload } from '@/core/domain/session.schema'
import type { FlightPrepDraft } from '@/core/domain/flightprep-draft.schema'

export async function exportPersonalData() {
  const fleet = await exportAllProfiles()
  const omissions: string[] = fleet.omitted.map(() => 'Unreadable aircraft profile')
  const sessions: SessionPayload[] = []
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
    if (result.kind === 'migrated' && (id === undefined || result.payload.aircraftId === id)) sessions.push(result.payload)
    else omissions.push(`${key}: unreadable session`)
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
  return { format: 'aerodash-personal-data', version: 1, exportedAt: fleet.envelope.exportedAt, fleet: fleet.envelope, sessions, drafts, omissions, complete: omissions.length === 0 }
}
