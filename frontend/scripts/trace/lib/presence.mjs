/**
 * Registry presence check.
 *
 * Document-level registries (`trace/requirements/`, `trace/journeys/`) are
 * the canonical machine-readable index of every REQ/UJ that appears in the
 * markdown source. STC §4.2 mandates one YAML file per module (REQ) and per
 * phase (UJ). Absent files break downstream tooling (shtracer can't build
 * the trace graph) and silently regress coverage reporting.
 *
 * This module derives the set of *expected* registry files from the source
 * scan and reports any that are missing. It is consumed by both:
 *
 *  - `pnpm trace check` — surfaces presence gaps alongside drift / orphan
 *    checks, exits non-zero in strict mode.
 *  - `presence.spec.ts` — keeps the CI unit-test gate honest even when
 *    `trace check` isn't part of a particular workflow.
 *
 * Deferred from the v0.3.0-alpha release audit.
 */

import { stat } from 'node:fs/promises'
import path from 'node:path'

import { REGISTRY_TARGETS } from './config.mjs'
import { scanAll } from './parser.mjs'

/**
 * @typedef {Object} ExpectedRegistry
 * @property {string} key         Lowercased group key (e.g. "mb", "a").
 * @property {string} relPath     Repo-relative YAML path that must exist.
 * @property {string[]} sourceIds Tag ids that demand the registry file.
 */

/**
 * @typedef {Object} PresenceReport
 * @property {ExpectedRegistry[]} missingRequirements  REQ groups with no YAML.
 * @property {ExpectedRegistry[]} missingJourneys      UJ groups with no YAML.
 * @property {ExpectedRegistry[]} satisfiedRequirements
 * @property {ExpectedRegistry[]} satisfiedJourneys
 */

/**
 * Group source occurrences by the first segment (module for REQ, phase
 * for UJ) and synthesise the expected YAML path.
 *
 * @param {import('./parser.mjs').TagOccurrence[]} occurrences
 * @param {string} targetDir          e.g. "trace/requirements"
 * @returns {ExpectedRegistry[]}
 */
function expectedRegistriesFor(occurrences, targetDir) {
  /** @type {Map<string, string[]>} */
  const byKey = new Map()
  for (const occ of occurrences) {
    const key = (occ.segments[0] ?? '').toLowerCase()
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(occ.id.replaceAll('@', ''))
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ids]) => ({
      key,
      relPath: `${targetDir}/${key}.yaml`,
      sourceIds: ids.sort(),
    }))
}

/**
 * Build the presence report for one repo root. Returns `missing*` arrays
 * the caller can use to print a diff or fail a gate.
 *
 * @param {string} repoRoot
 * @returns {Promise<PresenceReport>}
 */
export async function buildPresenceReport(repoRoot) {
  const scan = await scanAll(repoRoot)
  const reqExpected = expectedRegistriesFor(
    scan.byType.REQ || [],
    REGISTRY_TARGETS.REQ.dir,
  )
  const ujExpected = expectedRegistriesFor(
    scan.byType.UJ || [],
    REGISTRY_TARGETS.UJ.dir,
  )

  const missingRequirements = []
  const satisfiedRequirements = []
  for (const expected of reqExpected) {
    const exists = await fileExists(path.join(repoRoot, expected.relPath))
    if (exists) satisfiedRequirements.push(expected)
    else missingRequirements.push(expected)
  }

  const missingJourneys = []
  const satisfiedJourneys = []
  for (const expected of ujExpected) {
    const exists = await fileExists(path.join(repoRoot, expected.relPath))
    if (exists) satisfiedJourneys.push(expected)
    else missingJourneys.push(expected)
  }

  return {
    missingRequirements,
    missingJourneys,
    satisfiedRequirements,
    satisfiedJourneys,
  }
}

/**
 * @param {string} absPath
 * @returns {Promise<boolean>}
 */
async function fileExists(absPath) {
  try {
    const meta = await stat(absPath)
    return meta.isFile()
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return false
    throw err
  }
}
