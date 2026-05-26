/**
 * `trace check` — invariant + drift validation.
 *
 * Reports duplicate ids, dangling FROM references, orphaned IMPs (INV-001),
 * orphaned UT/IT (INV-002/003), and registry drift for every code-level
 * registry. Designed to be run locally before pushing and from CI by the
 * `Traceability Gate` workflow.
 *
 * Exit code is 0 on success, 1 when any violation is detected. The CLI
 * caller can downgrade to warn-only by wrapping the call.
 */

import { scanAll } from '../lib/parser.mjs'
import { findDanglingFromRefs, findDuplicates } from '../lib/id-generator.mjs'
import { REGISTRY_TARGETS } from '../lib/config.mjs'
import { diffRegistry, loadIndexedRegistry } from '../lib/registry.mjs'

/**
 * @typedef {Object} CheckReport
 * @property {{id: string, files: string[]}[]} duplicates
 * @property {{from: string, citedBy: string}[]} danglingFromRefs
 * @property {string[]} orphanImplementations  IMP ids with no @REQ-/@DES- in FROM.
 * @property {string[]} orphanUnitTests        UT ids with no @IMP- in FROM.
 * @property {string[]} orphanIntegrationTests IT ids with no @IMP- in FROM.
 * @property {Record<string, ReturnType<typeof diffRegistry>>} registryDrift
 */

/**
 * Apply the orphan rules (INV-001/INV-002/INV-003) to a parsed scan.
 *
 * @param {import('../lib/parser.mjs').ParseResult} scan
 */
function computeOrphans(scan) {
  const orphanImplementations = (scan.byType.IMP || [])
    .filter((occ) => !occ.fromTags.some((t) => t.startsWith('@REQ-') || t.startsWith('@DES-')))
    .map((occ) => occ.id)
    .sort()
  const orphanUnitTests = (scan.byType.UT || [])
    .filter((occ) => !occ.fromTags.some((t) => t.startsWith('@IMP-')))
    .map((occ) => occ.id)
    .sort()
  const orphanIntegrationTests = (scan.byType.IT || [])
    .filter((occ) => !occ.fromTags.some((t) => t.startsWith('@IMP-')))
    .map((occ) => occ.id)
    .sort()
  return { orphanImplementations, orphanUnitTests, orphanIntegrationTests }
}

/**
 * Build a structured check report without printing or exiting. Used by
 * unit tests to exercise the full pipeline on a sandbox repo.
 *
 * @param {string} repoRoot
 * @returns {Promise<CheckReport>}
 */
export async function buildCheckReport(repoRoot) {
  const scan = await scanAll(repoRoot)
  const duplicates = findDuplicates(scan.occurrences)
  const danglingFromRefs = findDanglingFromRefs(scan.occurrences)
  const orphans = computeOrphans(scan)
  /** @type {Record<string, ReturnType<typeof diffRegistry>>} */
  const registryDrift = {}
  for (const type of Object.keys(REGISTRY_TARGETS)) {
    const registry = await loadIndexedRegistry(repoRoot, /** @type {any} */ (type))
    const occurrences = scan.byType[/** @type {any} */ (type)] || []
    registryDrift[type] = diffRegistry(occurrences, registry)
  }
  return {
    duplicates,
    danglingFromRefs,
    ...orphans,
    registryDrift,
  }
}

/**
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {(message: string) => void} [opts.log]
 * @param {boolean} [opts.warnOnly]  Force exitCode 0 even when violations exist.
 */
export async function runCheck({ repoRoot, log = () => {}, warnOnly = false }) {
  const report = await buildCheckReport(repoRoot)
  let violations = 0
  const lines = []

  if (report.duplicates.length) {
    violations += report.duplicates.length
    lines.push('Duplicate tag declarations (INV-008):')
    for (const d of report.duplicates) {
      lines.push(`  ${d.id} declared at: ${d.files.join(', ')}`)
    }
  }
  if (report.danglingFromRefs.length) {
    violations += report.danglingFromRefs.length
    lines.push('Dangling FROM references (INV-009):')
    for (const d of report.danglingFromRefs) {
      lines.push(`  ${d.from} cited by ${d.citedBy}`)
    }
  }
  if (report.orphanImplementations.length) {
    violations += report.orphanImplementations.length
    lines.push('Orphaned implementations (INV-001):')
    for (const id of report.orphanImplementations) lines.push(`  ${id}`)
  }
  if (report.orphanUnitTests.length) {
    violations += report.orphanUnitTests.length
    lines.push('Orphaned unit tests (INV-002):')
    for (const id of report.orphanUnitTests) lines.push(`  ${id}`)
  }
  if (report.orphanIntegrationTests.length) {
    violations += report.orphanIntegrationTests.length
    lines.push('Orphaned integration tests (INV-003):')
    for (const id of report.orphanIntegrationTests) lines.push(`  ${id}`)
  }

  for (const [type, diff] of Object.entries(report.registryDrift)) {
    if (!diff.onlyInSource.length && !diff.onlyInRegistry.length && !diff.fileMismatches.length) {
      continue
    }
    violations += diff.onlyInSource.length + diff.onlyInRegistry.length + diff.fileMismatches.length
    lines.push(`Registry drift for ${type}:`)
    if (diff.onlyInSource.length) {
      lines.push('  In source but missing from registry:')
      for (const id of diff.onlyInSource) lines.push(`    ${id}`)
    }
    if (diff.onlyInRegistry.length) {
      lines.push('  In registry but missing from source:')
      for (const id of diff.onlyInRegistry) lines.push(`    ${id}`)
    }
    if (diff.fileMismatches.length) {
      lines.push('  File-list mismatch (source vs registry):')
      for (const m of diff.fileMismatches) {
        lines.push(`    ${m.id}: source=${m.sourceFiles.join(',')}; registry=${m.registryFiles.join(',')}`)
      }
    }
  }

  if (violations === 0) {
    log('Traceability check passed: no violations detected.')
    return { stdout: '', exitCode: 0, report }
  }

  for (const l of lines) log(l)
  log(`Traceability check found ${violations} violation(s).`)
  return { stdout: '', exitCode: warnOnly ? 0 : 1, report }
}
