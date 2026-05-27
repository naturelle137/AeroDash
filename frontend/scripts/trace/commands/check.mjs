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
 *
 * Structural-only mode (`--structural-only`, REQ-SYS-005) gates merges on
 * the three checks that should hard-fail today — duplicate-tag,
 * dangling-FROM, registry-drift — while ignoring orphan/coverage gaps
 * (those remain warn-only). It is the surface wired into `pnpm lint` and
 * the vitest structural-gate spec, and accepts an optional `--baseline`
 * JSON snapshot so pre-existing violations can be ratcheted down rather
 * than blocking every PR until the trace graph is fully clean.
 */

import { readFile } from 'node:fs/promises'

import { scanAll } from '../lib/parser.mjs'
import { findDanglingFromRefs, findDuplicates } from '../lib/id-generator.mjs'
import { REGISTRY_TARGETS } from '../lib/config.mjs'
import { buildPresenceReport } from '../lib/presence.mjs'
import { diffRegistry, loadIndexedRegistry } from '../lib/registry.mjs'

/**
 * @typedef {Object} CheckReport
 * @property {{id: string, files: string[]}[]} duplicates
 * @property {{from: string, citedBy: string}[]} danglingFromRefs
 * @property {string[]} orphanImplementations  IMP ids with no @REQ-/@DES- in FROM.
 * @property {string[]} orphanUnitTests        UT ids with no @IMP- in FROM.
 * @property {string[]} orphanIntegrationTests IT ids with no @IMP- in FROM.
 * @property {Record<string, ReturnType<typeof diffRegistry>>} registryDrift
 * @property {import('../lib/presence.mjs').PresenceReport} presence
 *           Document-registry presence — REQ/UJ YAML files missing from
 *           trace/requirements/ and trace/journeys/ (issue #264 / STC §4.2).
 */

/**
 * @typedef {Object} StructuralBaseline
 * @property {string[]} duplicates             Pre-existing duplicate ids (with @ delimiters).
 * @property {string[]} danglingFromRefs       Pre-existing undefined ids cited via FROM (with @ delimiters).
 * @property {Record<string, { onlyInSource: string[], onlyInRegistry: string[], fileMismatches: string[] }>} registryDrift
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
  const presence = await buildPresenceReport(repoRoot)
  return {
    duplicates,
    danglingFromRefs,
    ...orphans,
    registryDrift,
    presence,
  }
}

/**
 * Project the structural slice of a check report into the stable
 * id-only shape used both by the baseline file on disk and by the
 * baseline-diff logic. Keeps the gate independent of incidental
 * details like file paths or line numbers.
 *
 * @param {CheckReport} report
 * @returns {StructuralBaseline}
 */
export function projectStructuralBaseline(report) {
  const duplicates = report.duplicates.map((d) => d.id).slice().sort()
  const danglingFromRefs = Array.from(new Set(report.danglingFromRefs.map((d) => d.from))).sort()
  /** @type {StructuralBaseline['registryDrift']} */
  const registryDrift = {}
  for (const [type, diff] of Object.entries(report.registryDrift)) {
    registryDrift[type] = {
      onlyInSource: diff.onlyInSource.slice().sort(),
      onlyInRegistry: diff.onlyInRegistry.slice().sort(),
      fileMismatches: diff.fileMismatches.map((m) => m.id).slice().sort(),
    }
  }
  return { duplicates, danglingFromRefs, registryDrift }
}

/**
 * Compute the structural violations present in `current` but **not** in
 * `baseline`. Resolved-since-baseline entries do not surface — the gate
 * only fires on regressions.
 *
 * @param {StructuralBaseline} current
 * @param {StructuralBaseline} baseline
 * @returns {StructuralBaseline}
 */
export function diffAgainstBaseline(current, baseline) {
  /** @param {string[]} a @param {string[]|undefined} b */
  const newOnly = (a, b) => {
    const known = new Set(b ?? [])
    return a.filter((id) => !known.has(id)).sort()
  }
  /** @type {StructuralBaseline['registryDrift']} */
  const registryDrift = {}
  const types = new Set([
    ...Object.keys(current.registryDrift),
    ...Object.keys(baseline.registryDrift ?? {}),
  ])
  for (const type of types) {
    const curDiff = current.registryDrift[type] ?? { onlyInSource: [], onlyInRegistry: [], fileMismatches: [] }
    const baseDiff = baseline.registryDrift?.[type] ?? { onlyInSource: [], onlyInRegistry: [], fileMismatches: [] }
    const onlyInSource = newOnly(curDiff.onlyInSource, baseDiff.onlyInSource)
    const onlyInRegistry = newOnly(curDiff.onlyInRegistry, baseDiff.onlyInRegistry)
    const fileMismatches = newOnly(curDiff.fileMismatches, baseDiff.fileMismatches)
    if (onlyInSource.length || onlyInRegistry.length || fileMismatches.length) {
      registryDrift[type] = { onlyInSource, onlyInRegistry, fileMismatches }
    }
  }
  return {
    duplicates: newOnly(current.duplicates, baseline.duplicates),
    danglingFromRefs: newOnly(current.danglingFromRefs, baseline.danglingFromRefs),
    registryDrift,
  }
}

/**
 * Count the violations remaining in a baseline-shaped object.
 *
 * @param {StructuralBaseline} snapshot
 * @returns {number}
 */
export function countStructural(snapshot) {
  let n = snapshot.duplicates.length + snapshot.danglingFromRefs.length
  for (const diff of Object.values(snapshot.registryDrift)) {
    n += diff.onlyInSource.length + diff.onlyInRegistry.length + diff.fileMismatches.length
  }
  return n
}

/**
 * Format the structural slice for stdout — matches the long-form
 * report so reviewers see the same shape whether the gate is on or off.
 *
 * @param {StructuralBaseline} snapshot
 * @returns {string[]}
 */
function formatStructuralLines(snapshot) {
  const lines = []
  if (snapshot.duplicates.length) {
    lines.push('Duplicate tag declarations (INV-008):')
    for (const id of snapshot.duplicates) lines.push(`  ${id}`)
  }
  if (snapshot.danglingFromRefs.length) {
    lines.push('Dangling FROM references (INV-009):')
    for (const id of snapshot.danglingFromRefs) lines.push(`  ${id}`)
  }
  for (const [type, diff] of Object.entries(snapshot.registryDrift)) {
    if (!diff.onlyInSource.length && !diff.onlyInRegistry.length && !diff.fileMismatches.length) {
      continue
    }
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
      for (const id of diff.fileMismatches) lines.push(`    ${id}`)
    }
  }
  return lines
}

/**
 * Read a structural baseline JSON file. Returns the empty baseline when
 * `path` is null/undefined so callers can treat "no baseline" as
 * "everything must be clean".
 *
 * @param {string|undefined|null} baselinePath
 * @returns {Promise<StructuralBaseline>}
 */
export async function loadStructuralBaseline(baselinePath) {
  if (!baselinePath) {
    return { duplicates: [], danglingFromRefs: [], registryDrift: {} }
  }
  const text = await readFile(baselinePath, 'utf8')
  /** @type {Partial<StructuralBaseline>} */
  const parsed = JSON.parse(text)
  return {
    duplicates: parsed.duplicates ?? [],
    danglingFromRefs: parsed.danglingFromRefs ?? [],
    registryDrift: parsed.registryDrift ?? {},
  }
}

/**
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {(message: string) => void} [opts.log]
 * @param {boolean} [opts.warnOnly]         Force exitCode 0 even when violations exist.
 * @param {boolean} [opts.structuralOnly]   Gate only on duplicates / dangling-FROM / drift.
 * @param {string} [opts.baselinePath]      JSON file listing pre-existing structural violations to ratchet.
 */
export async function runCheck({ repoRoot, log = () => {}, warnOnly = false, structuralOnly = false, baselinePath }) {
  const report = await buildCheckReport(repoRoot)

  if (structuralOnly) {
    const current = projectStructuralBaseline(report)
    const baseline = await loadStructuralBaseline(baselinePath)
    const newViolations = diffAgainstBaseline(current, baseline)
    const newCount = countStructural(newViolations)
    const lines = formatStructuralLines(newViolations)

    if (newCount === 0) {
      log('Traceability structural check passed: no new violations.')
      return { stdout: '', exitCode: 0, report, structural: { current, baseline, newViolations } }
    }
    for (const l of lines) log(l)
    log(
      `Traceability structural check found ${newCount} new violation(s) beyond the baseline. ` +
        'Re-run with --update-baseline only after the underlying tag/registry conflict is fixed.',
    )
    return {
      stdout: '',
      exitCode: warnOnly ? 0 : 1,
      report,
      structural: { current, baseline, newViolations },
    }
  }

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

  // STC §4.2 / issue #264: every module with REQ tags and every phase
  // with UJ tags MUST own a YAML registry file. Surface gaps so the
  // shtracer registry never silently regresses to an empty index.
  if (report.presence.missingRequirements.length) {
    violations += report.presence.missingRequirements.length
    lines.push('Missing requirement registries (STC §4.2):')
    for (const exp of report.presence.missingRequirements) {
      lines.push(`  ${exp.relPath} (needed by ${exp.sourceIds.length} REQ tag(s): ${exp.sourceIds.slice(0, 3).join(', ')}${exp.sourceIds.length > 3 ? '…' : ''})`)
    }
  }
  if (report.presence.missingJourneys.length) {
    violations += report.presence.missingJourneys.length
    lines.push('Missing journey registries (STC §4.2):')
    for (const exp of report.presence.missingJourneys) {
      lines.push(`  ${exp.relPath} (needed by ${exp.sourceIds.length} UJ tag(s): ${exp.sourceIds.slice(0, 3).join(', ')}${exp.sourceIds.length > 3 ? '…' : ''})`)
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
