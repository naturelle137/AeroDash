import {
  createManualRunwayRecord,
  recoverManualRunwayRecord,
  type ManualRunway,
  type ManualRunwayRecord,
} from '@/core/logic/manual-runway'

/** Erased by "Delete all local data" through the shared `aerodash` prefix. */
export const MANUAL_RUNWAY_STORAGE_KEY = 'aerodash.performance.manual-runway.v1'

export type ManualRunwayLoad =
  | { status: 'empty' }
  | { status: 'loaded'; record: ManualRunwayRecord }
  | { status: 'error'; reason: 'unavailable' | 'corrupt' | 'unsupported-version'; message: string }
export type ManualRunwayWrite =
  | { status: 'ok'; record: ManualRunwayRecord | null }
  | { status: 'error'; message: string }

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadManualRunway(): ManualRunwayLoad {
  const store = storage()
  let raw: string | null
  try {
    if (!store) throw new Error('unavailable')
    raw = store.getItem(MANUAL_RUNWAY_STORAGE_KEY)
  } catch {
    return { status: 'error', reason: 'unavailable', message: 'Browser storage is unavailable. Manual runway inputs cannot be restored or saved on this device.' }
  }
  const recovered = recoverManualRunwayRecord(raw)
  switch (recovered.status) {
    case 'empty': return { status: 'empty' }
    case 'loaded': return { status: 'loaded', record: recovered.record }
    case 'unsupported-version':
      return { status: 'error', reason: 'unsupported-version', message: `Saved manual runway uses newer format version ${recovered.schemaVersion}. It was not used. Update AeroDash, or re-enter and save to replace it.` }
    case 'corrupt':
      return { status: 'error', reason: 'corrupt', message: 'Saved manual runway data is damaged or invalid. It was not used. Re-enter and save the runway inputs, or clear the saved entry.' }
  }
}

export function saveManualRunway(runway: ManualRunway, now: Date): ManualRunwayWrite {
  const record = createManualRunwayRecord(runway, now)
  try {
    const store = storage()
    if (!store) throw new Error('unavailable')
    store.setItem(MANUAL_RUNWAY_STORAGE_KEY, JSON.stringify(record))
    return { status: 'ok', record }
  } catch {
    return { status: 'error', message: 'Could not save manual runway inputs to browser storage. They are not persisted; check storage permissions or free space.' }
  }
}

export function clearManualRunway(): ManualRunwayWrite {
  try {
    const store = storage()
    if (!store) throw new Error('unavailable')
    store.removeItem(MANUAL_RUNWAY_STORAGE_KEY)
    return { status: 'ok', record: null }
  } catch {
    return { status: 'error', message: 'Could not clear the saved manual runway from browser storage.' }
  }
}
