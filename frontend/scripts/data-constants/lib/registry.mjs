/**
 * Data-constants registry loader + validator (pure Node, no framework deps).
 *
 * Validates docs/data_constants/registry.json for the data-constants gate:
 * schema completeness, source citation, and staleness. Code-vs-registry DRIFT
 * is asserted separately in the Vitest spec (it must import the real TS
 * constants). Source-of-truth + policy: docs/data_constants/README.md (#275).
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const REGISTRY_REL = 'docs/data_constants/registry.json'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Absolute path to registry.json for a given repo root. */
export function registryPath(repoRoot) {
  return path.join(repoRoot, REGISTRY_REL)
}

/** Read + parse registry.json. */
export async function loadRegistry(repoRoot) {
  const raw = await readFile(registryPath(repoRoot), 'utf8')
  return JSON.parse(raw)
}

/** Parse an ISO `YYYY-MM-DD` date to epoch ms, or null when malformed. */
function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Validate the registry.
 *
 * @param {unknown} registry parsed registry.json
 * @param {Date} [now] reference date for the staleness check
 * @returns {{ ok: boolean, schemaErrors: string[], uncited: string[], stale: string[] }}
 */
export function validateRegistry(registry, now = new Date()) {
  const schemaErrors = []
  const uncited = []
  const stale = []
  const nowMs = now.getTime()

  if (!registry || typeof registry !== 'object' || !Array.isArray(registry.constants)) {
    return { ok: false, schemaErrors: ['registry.constants must be an array'], uncited, stale }
  }

  const seenIds = new Set()
  registry.constants.forEach((entry, i) => {
    const where = entry && typeof entry.id === 'string' ? entry.id : `constants[${i}]`
    if (!entry || typeof entry !== 'object') {
      schemaErrors.push(`${where}: not an object`)
      return
    }

    if (typeof entry.id !== 'string' || entry.id.trim() === '') {
      schemaErrors.push(`${where}: missing id`)
    } else if (seenIds.has(entry.id)) {
      schemaErrors.push(`${where}: duplicate id`)
    } else {
      seenIds.add(entry.id)
    }

    if (typeof entry.unit !== 'string' || entry.unit.trim() === '') {
      schemaErrors.push(`${where}: missing unit`)
    }
    if (entry.value === undefined || entry.value === null) {
      schemaErrors.push(`${where}: missing value`)
    }
    if (typeof entry.requirement !== 'string' || !entry.requirement.startsWith('REQ-')) {
      schemaErrors.push(`${where}: missing/invalid requirement (expected REQ-…)`)
    }
    if (
      !entry.code ||
      typeof entry.code !== 'object' ||
      typeof entry.code.file !== 'string' ||
      entry.code.file.trim() === '' ||
      typeof entry.code.symbol !== 'string' ||
      entry.code.symbol.trim() === ''
    ) {
      schemaErrors.push(`${where}: missing code.file/code.symbol`)
    }

    if (typeof entry.source !== 'string' || entry.source.trim() === '') {
      uncited.push(where)
    }

    const eff = parseIsoDate(entry.effectiveDate)
    const rev = parseIsoDate(entry.reviewBy)
    if (eff === null) schemaErrors.push(`${where}: missing/invalid effectiveDate (YYYY-MM-DD)`)
    if (rev === null) schemaErrors.push(`${where}: missing/invalid reviewBy (YYYY-MM-DD)`)
    if (eff !== null && rev !== null && rev < eff) {
      schemaErrors.push(`${where}: reviewBy precedes effectiveDate`)
    }

    if (rev !== null && rev < nowMs) stale.push(where)
  })

  const ok = schemaErrors.length === 0 && uncited.length === 0 && stale.length === 0
  return { ok, schemaErrors, uncited, stale }
}
