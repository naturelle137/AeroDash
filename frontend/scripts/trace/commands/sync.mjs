/**
 * `trace sync` — regenerate the code-level `trace/` registries from the
 * source-of-truth scan.
 *
 * Sync preserves existing curated titles and group labels; it only
 * adds/removes entries to match what the parser observed. Stale entries
 * are removed unless they carry `status: deleted` (or `obsolete`), in
 * which case the tombstone is preserved per STC §5.2.
 *
 * Without `--apply` the command runs in dry-run mode and reports the
 * planned changes only.
 */

import { REGISTRY_TARGETS } from '../lib/config.mjs'
import { scanAll } from '../lib/parser.mjs'
import {
  entryFromOccurrence,
  loadRegistryDir,
  serialiseRegistry,
  writeRegistry,
} from '../lib/registry.mjs'

/** @typedef {import('../lib/config.mjs').TagType} TagType */
/** @typedef {import('../lib/registry.mjs').RegistryEntry} RegistryEntry */

/**
 * Build the merged entry list for one tag type. Returns the new list of
 * RegistryFile objects suitable for serialisation. The "owning file" of
 * each entry is preserved when present in the registry; new entries land
 * in a default file named after the first segment lower-cased.
 *
 * @param {TagType} type
 * @param {import('../lib/parser.mjs').TagOccurrence[]} occurrences
 * @param {import('../lib/registry.mjs').RegistryFile[]} existing
 * @returns {{
 *   updatedFiles: Map<string, RegistryEntry[]>,
 *   added: string[],
 *   removed: string[],
 * }}
 */
export function planSync(type, occurrences, existing) {
  const target = REGISTRY_TARGETS[type]
  if (!target) throw new Error(`No registry target for type ${type}`)

  // Per-file working copy of entries, keyed by file rel path.
  /** @type {Map<string, RegistryEntry[]>} */
  const byFile = new Map()
  /** @type {Map<string, string>} */
  const fileOfEntry = new Map()
  for (const file of existing) {
    byFile.set(file.relPath, [...file.entries])
    for (const e of file.entries) fileOfEntry.set(e.id, file.relPath)
  }

  // Index source-of-truth occurrences by bare id.
  /** @type {Map<string, import('../lib/parser.mjs').TagOccurrence>} */
  const sourceById = new Map()
  for (const occ of occurrences) {
    const id = occ.id.replaceAll('@', '')
    if (!sourceById.has(id)) sourceById.set(id, occ)
  }

  const added = []
  const removed = []

  // Add missing entries.
  for (const [id, occ] of sourceById.entries()) {
    if (fileOfEntry.has(id)) continue
    const entry = entryFromOccurrence(occ)
    const fileKey = `${target.dir}/${(occ.segments[0] ?? type).toLowerCase()}.yaml`
    if (!byFile.has(fileKey)) byFile.set(fileKey, [])
    byFile.get(fileKey).push(entry)
    added.push(id)
  }

  // Remove stale entries (entries the source no longer declares). Skip
  // tombstones (status: deleted/obsolete) per STC §5.2.
  for (const [fileKey, entries] of byFile.entries()) {
    const filtered = entries.filter((e) => {
      if (sourceById.has(e.id)) return true
      if (e.scalars.status === 'deleted' || e.scalars.status === 'obsolete') return true
      removed.push(e.id)
      return false
    })
    byFile.set(fileKey, filtered)
  }

  // Update file lists for entries whose source files moved.
  for (const [fileKey, entries] of byFile.entries()) {
    for (const entry of entries) {
      const occ = sourceById.get(entry.id)
      if (!occ) continue
      const desired = [occ.file]
      const current = entry.lists.files
      if (current && current.length === 1 && current[0] === desired[0]) continue
      if (!current && entry.scalars.file === desired[0]) continue
      // Preserve user-curated multi-file entries unless the only file
      // changed. We don't try to be clever here — drift is reported by
      // `trace check` and the dev resolves it manually.
      if (current && current.length > 1) continue
      entry.lists.files = desired
      // Suppress the legacy `file:` scalar to keep one source of truth.
      delete entry.scalars.file
      void fileKey
    }
  }

  return { updatedFiles: byFile, added: added.sort(), removed: removed.sort() }
}

/**
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {boolean} [opts.apply=false]
 * @param {TagType[]} [opts.types]      Restrict sync to specific types (defaults to all REGISTRY_TARGETS).
 * @param {(message: string) => void} [opts.log]
 */
export async function runSync({ repoRoot, apply = false, types, log = () => {} }) {
  const scan = await scanAll(repoRoot)
  const selectedTypes = types?.length ? types : Object.keys(REGISTRY_TARGETS)
  const report = /** @type {Record<string, {added: string[], removed: string[], files: string[]}>} */ ({})

  for (const type of selectedTypes) {
    const target = REGISTRY_TARGETS[type]
    if (!target) continue
    const existing = await loadRegistryDir(repoRoot, target.dir)
    const { updatedFiles, added, removed } = planSync(/** @type {TagType} */ (type), scan.byType[type] || [], existing)
    const touched = []
    for (const [relPath, entries] of updatedFiles.entries()) {
      const original = existing.find((f) => f.relPath === relPath)
      const originalText = original ? serialiseRegistry(original.entries) : null
      const newText = serialiseRegistry(entries)
      if (originalText === newText) continue
      touched.push(relPath)
      if (apply) await writeRegistry(repoRoot, relPath, entries)
    }
    report[type] = { added, removed, files: touched }
  }

  for (const [type, info] of Object.entries(report)) {
    if (!info.added.length && !info.removed.length && !info.files.length) continue
    log(`[${type}] added=${info.added.length} removed=${info.removed.length} files=${info.files.length}`)
    for (const id of info.added) log(`  + ${id}`)
    for (const id of info.removed) log(`  - ${id}`)
  }
  if (!apply) log('(dry-run: pass --apply to write changes)')
  return { exitCode: 0, report }
}
