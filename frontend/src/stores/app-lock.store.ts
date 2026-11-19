import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createLogger } from '@/shared/utils/logger'

const logger = createLogger('AppLock')

// Starts with `aerodash.` so Delete-All-Data removes the verifier too; that
// erasure is the only recovery for a forgotten passcode.
export const STORAGE_KEY = 'aerodash.applock.v1'
export const CHANNEL_NAME = 'aerodash-applock'
export const MIN_PASSCODE_LENGTH = 6
export const MAX_PASSCODE_LENGTH = 64

const SCHEMA_VERSION = 1 as const
const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const HASH_BITS = 256

interface LockRecord {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly iterations: number
  readonly salt: string
  readonly hash: string
}

export type SetPasscodeResult = 'ok' | 'invalid-length' | 'unsupported' | 'storage-failed'
export type VerifyResult = 'ok' | 'wrong' | 'unsupported'

type Message = 'lock' | 'config'

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

function isLockRecord(value: unknown): value is LockRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.schemaVersion === SCHEMA_VERSION &&
    typeof v.iterations === 'number' &&
    Number.isInteger(v.iterations) &&
    v.iterations > 0 &&
    v.iterations <= 10_000_000 &&
    typeof v.salt === 'string' &&
    typeof v.hash === 'string'
  )
}

async function derive(passcode: string, salt: Uint8Array, iterations: number): Promise<Uint8Array | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  try {
    const material = await subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, [
      'deriveBits',
    ])
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
      material,
      HASH_BITS,
    )
    return new Uint8Array(bits)
  } catch {
    return null
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

/**
 * Optional local access gate. It hides the app UI behind a passcode verifier
 * kept in localStorage. It does NOT encrypt stored data and cannot resist
 * someone with browser developer tools, copied browser files or same-origin
 * code; see ADR-016. Unlocked state lives only in this tab's memory.
 */
export const useAppLockStore = defineStore('appLock', () => {
  const enabled = ref(false)
  // Locked until the stored configuration has been read, so first paint
  // cannot expose the app when a lock exists.
  const locked = ref(true)
  const loaded = ref(false)
  const storageUnavailable = ref(false)
  // A stored record that cannot be parsed keeps the app locked; only erasure
  // (which removes the record) recovers, because the passcode cannot be checked.
  const recordCorrupt = ref(false)

  let record: LockRecord | null = null
  let channel: BroadcastChannel | null = null

  function readRecord(): void {
    record = null
    recordCorrupt.value = false
    let raw: string | null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
      storageUnavailable.value = false
    } catch {
      // Nothing can be persisted or protected without storage; fail open.
      storageUnavailable.value = true
      enabled.value = false
      locked.value = false
      return
    }
    if (raw === null) {
      enabled.value = false
      locked.value = false
      return
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    enabled.value = true
    if (isLockRecord(parsed) && fromBase64(parsed.salt) && fromBase64(parsed.hash)) {
      record = parsed
    } else {
      recordCorrupt.value = true
      locked.value = true
      logger.error('App lock record unreadable; staying locked', { code: 'APP_LOCK_RECORD_INVALID' })
    }
  }

  function post(message: Message): void {
    try {
      channel?.postMessage(message)
    } catch {
      // Other tabs simply keep their own state until reload.
    }
  }

  /** Read persisted configuration; locks the tab when a lock is configured. */
  function load(): void {
    loaded.value = true
    readRecord()
    if (enabled.value) locked.value = true
    if (channel === null && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'lock') {
          if (enabled.value) locked.value = true
        } else if (event.data === 'config') {
          const wasLocked = locked.value
          readRecord()
          // A lock enabled elsewhere does not lock a tab the pilot is using;
          // a lock removed elsewhere opens it. A changed passcode locks it.
          locked.value = enabled.value ? wasLocked || recordCorrupt.value : false
        }
      }
    }
  }

  function closeChannel(): void {
    channel?.close()
    channel = null
  }

  async function verify(passcode: string): Promise<VerifyResult> {
    if (record === null) return 'wrong'
    const salt = fromBase64(record.salt)
    const expected = fromBase64(record.hash)
    if (!salt || !expected) return 'wrong'
    const actual = await derive(passcode, salt, record.iterations)
    if (actual === null) return 'unsupported'
    return sameBytes(actual, expected) ? 'ok' : 'wrong'
  }

  async function unlock(passcode: string): Promise<VerifyResult> {
    const result = await verify(passcode)
    if (result === 'ok') locked.value = false
    return result
  }

  /** Lock this tab and every other open AeroDash tab. */
  function lock(): void {
    if (!enabled.value) return
    locked.value = true
    post('lock')
  }

  async function enable(passcode: string): Promise<SetPasscodeResult> {
    if (passcode.length < MIN_PASSCODE_LENGTH || passcode.length > MAX_PASSCODE_LENGTH) {
      return 'invalid-length'
    }
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const hash = await derive(passcode, salt, PBKDF2_ITERATIONS)
    if (hash === null) return 'unsupported'
    const next: LockRecord = {
      schemaVersion: SCHEMA_VERSION,
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
      hash: toBase64(hash),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      return 'storage-failed'
    }
    record = next
    recordCorrupt.value = false
    enabled.value = true
    // The pilot just proved presence by choosing the passcode.
    locked.value = false
    post('config')
    return 'ok'
  }

  /** Remove the lock after the current passcode is verified. */
  async function disable(passcode: string): Promise<VerifyResult | 'storage-failed'> {
    const result = await verify(passcode)
    if (result !== 'ok') return result
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      return 'storage-failed'
    }
    record = null
    enabled.value = false
    locked.value = false
    post('config')
    return 'ok'
  }

  /** Re-read storage, e.g. after Delete-All-Data removed the verifier. */
  function reload(): void {
    readRecord()
    locked.value = enabled.value
    post('config')
  }

  return {
    enabled,
    locked,
    loaded,
    storageUnavailable,
    recordCorrupt,
    load,
    closeChannel,
    unlock,
    lock,
    enable,
    disable,
    reload,
  }
})
