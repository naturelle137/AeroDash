// @IMP-SYS-STORE-022@ (FROM: @REQ-SYS-016@)

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createLogger } from '@/shared/utils/logger'
import { isValidSemVer, parseSemVer } from '@/stores/app-version.semver'

const logger = createLogger('DisclaimerAcknowledgement')

export const STORAGE_KEY = 'aerodash.disclaimer.ack.v1'

const SCHEMA_VERSION = 1 as const

export interface AcknowledgementRecord {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly acceptedVersion: string
  readonly acceptedBaseline: string
  readonly acceptedAt: number
}

export function computeDisclaimerBaseline(version: unknown): string | null {
  if (!isValidSemVer(version)) return null
  try {
    const parts = parseSemVer(version)
    return `${parts.major}.${parts.minor}`
  } catch {
    return null
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isAcknowledgementRecord(value: unknown): value is AcknowledgementRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.schemaVersion === SCHEMA_VERSION &&
    typeof v.acceptedVersion === 'string' &&
    typeof v.acceptedBaseline === 'string' &&
    typeof v.acceptedAt === 'number' &&
    Number.isFinite(v.acceptedAt)
  )
}

export const useDisclaimerAcknowledgementStore = defineStore('disclaimerAcknowledgement', () => {
  const currentVersion = ref(__APP_VERSION__)
  const currentBaseline = ref<string | null>(computeDisclaimerBaseline(__APP_VERSION__))
  const storedRecord = ref<AcknowledgementRecord | null>(null)
  // Initially open so the first-paint window cannot leak the safety-critical
  // surfaces before loadFromStorage() resolves the stored acceptance.
  const gateOpen = ref(true)
  const loaded = ref(false)
  const storageUnavailable = ref(false)

  function loadFromStorage(): void {
    loaded.value = true
    const baseline = currentBaseline.value
    if (baseline === null) {
      // Unparseable build version — fail closed.
      gateOpen.value = true
      storedRecord.value = null
      logger.error('Disclaimer baseline could not be computed; failing closed', {
        code: 'DISCLAIMER_BASELINE_INVALID',
        version: String(currentVersion.value),
      })
      return
    }

    let raw: string | null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
      storageUnavailable.value = false
    } catch {
      storageUnavailable.value = true
      gateOpen.value = true
      storedRecord.value = null
      logger.warn('localStorage unavailable for disclaimer ack; gate stays open', {
        code: 'DISCLAIMER_STORAGE_UNAVAILABLE',
      })
      return
    }

    if (raw === null) {
      gateOpen.value = true
      storedRecord.value = null
      return
    }

    const parsed = safeJsonParse(raw)
    if (!isAcknowledgementRecord(parsed)) {
      gateOpen.value = true
      storedRecord.value = null
      logger.warn('Disclaimer ack record corrupt; treating as absent', {
        code: 'DISCLAIMER_RECORD_CORRUPT',
      })
      return
    }

    storedRecord.value = parsed
    if (parsed.acceptedBaseline === baseline) {
      gateOpen.value = false
    } else {
      gateOpen.value = true
      logger.info('Disclaimer baseline changed; re-prompting pilot', {
        code: 'DISCLAIMER_BASELINE_CHANGED',
        previousBaseline: parsed.acceptedBaseline,
        currentBaseline: baseline,
      })
    }
  }

  function acknowledge(now: () => number = Date.now): boolean {
    const baseline = currentBaseline.value
    if (baseline === null) {
      logger.error('Disclaimer acknowledge rejected — baseline is invalid', {
        code: 'DISCLAIMER_BASELINE_INVALID',
      })
      return false
    }
    const record: AcknowledgementRecord = {
      schemaVersion: SCHEMA_VERSION,
      acceptedVersion: currentVersion.value,
      acceptedBaseline: baseline,
      acceptedAt: now(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch {
      // Scoped to write-time failure only (M3): do not flip the read-time
      // `storageUnavailable` flag, otherwise the generic "storage unavailable"
      // advisory would shadow the more specific "browser refused the write"
      // message in the modal — pointing the pilot at the wrong remediation
      // (switch browser vs. clear quota).
      logger.warn('localStorage write failed for disclaimer ack; gate stays open', {
        code: 'DISCLAIMER_STORAGE_WRITE_FAILED',
      })
      return false
    }
    storedRecord.value = record
    gateOpen.value = false
    return true
  }

  function resetForTesting(): void {
    storedRecord.value = null
    gateOpen.value = true
    loaded.value = false
    storageUnavailable.value = false
  }

  return {
    currentVersion,
    currentBaseline,
    storedRecord,
    gateOpen,
    loaded,
    storageUnavailable,
    loadFromStorage,
    acknowledge,
    resetForTesting,
  }
})
