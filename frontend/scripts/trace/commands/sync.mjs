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

import { configFor, knownExtensions, REGISTRY_TARGETS } from '../lib/config.mjs'
import { scanAll } from '../lib/parser.mjs'
import {
  entryFromOccurrence,
  isTombstone,
  loadRegistryDir,
  serialiseRegistry,
  writeRegistry,
} from '../lib/registry.mjs'

/** @typedef {import('../lib/config.mjs').TagType} TagType */
/** @typedef {import('../lib/registry.mjs').RegistryEntry} RegistryEntry */

// Sync delegates "should this entry survive a removal pass?" to the
// shared `isTombstone(entry)` predicate in lib/registry.mjs. Keep the two
// in lockstep — diverging here while `check`'s `diffRegistry` reads the
// same predicate is exactly what review M2 flagged.

/**
 * Decide which YAML file a newly-discovered occurrence should be written
 * into. The goal is to never split a curated group across two files. We
 * therefore prefer the file that already contains an entry sharing the
 * same group key (first segment), and only fall back to a `<key>.yaml`
 * filename when no curated home exists.
 *
 * @param {import('../lib/parser.mjs').TagOccurrence} occ
 * @param {string} typeDir                                    e.g. "trace/e2e"
 * @param {Map<string, RegistryEntry[]>} byFile
 * @param {TagType} type
 * @returns {string}
 */
function pickRegistryFile(occ, typeDir, byFile, type) {
  const groupKey = (occ.segments[0] ?? type).toLowerCase()
  // First-pass: a curated file already owns an entry whose group key
  // matches — route the new entry into it so phase A E2Es stay together
  // in `fleet-management.yaml`, journeys stay in `phase-b.yaml`, etc.
  for (const [filePath, entries] of byFile.entries()) {
    if (!filePath.startsWith(`${typeDir}/`)) continue
    for (const e of entries) {
      const parts = e.id.split('-')
      // For multi-segment ids (e.g. IMP-MB-CORE-001) the first segment is
      // the group key. For single-segment ids (e.g. H-001) we use the type.
      const existingKey = (parts[1] ?? parts[0]).toLowerCase()
      if (existingKey === groupKey) return filePath
    }
  }
  return `${typeDir}/${groupKey}.yaml`
}

/**
 * Build the merged entry list for one tag type. Returns the new list of
 * RegistryFile objects suitable for serialisation. The "owning file" of
 * each entry is preserved when present in the registry; new entries land
 * in a curated file that already serves the same group, or in a default
 * `<group>.yaml` when no curated file exists.
 *
 * @param {TagType} type
 * @param {import('../lib/parser.mjs').TagOccurrence[]} occurrences
 * @param {import('../lib/registry.mjs').RegistryFile[]} existing
 * @returns {{
 *   updatedFiles: Map<string, RegistryEntry[]>,
 *   added: string[],
 *   removed: string[],
 *   preserved: string[],
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

  // Index source-of-truth occurrences by bare id. A declaration always
  // wins over a citation so the registry entry's `file` field points at
  // the tag's home document — never at a downstream artifact that merely
  // cites it via `(FROM: …)`.
  /** @type {Map<string, import('../lib/parser.mjs').TagOccurrence>} */
  const sourceById = new Map()
  for (const occ of occurrences) {
    const id = occ.id.replaceAll('@', '')
    const existing = sourceById.get(id)
    if (!existing) {
      sourceById.set(id, occ)
      continue
    }
    if (existing.declared === false && occ.declared !== false) {
      sourceById.set(id, occ)
    }
  }

  const exts = knownExtensions()
  // Canonical-id check: if a registry entry's id doesn't match the type's
  // strict tag regex (e.g. a legacy 3-segment IMP id `IMP-MB-UI-FLEET-002`
  // when the canonical shape is 2 segments) the parser can never see it,
  // so removing it would just be a scanner-blind-spot mistake.
  const typeCfg = configFor(type)
  const canonicalIdRegex = typeCfg
    ? new RegExp(`^${typeCfg.tagRegex.source.replace(/\(\?<!\[A-Z0-9-]\)|\(\?!\[A-Z0-9-]\)/g, '').replace(/@/g, '')}$`)
    : null
  const added = []
  const removed = []
  const preserved = []

  // Add missing entries.
  for (const [id, occ] of sourceById.entries()) {
    if (fileOfEntry.has(id)) continue
    const entry = entryFromOccurrence(occ)
    const fileKey = pickRegistryFile(occ, target.dir, byFile, type)
    if (!byFile.has(fileKey)) byFile.set(fileKey, [])
    byFile.get(fileKey).push(entry)
    added.push(id)
  }

  // Remove stale entries (entries the source no longer declares). Skip
  // tombstones (status: deleted/obsolete/pending) per STC §5.2 and the
  // CLI's defensive-remove rule (m5): never drop an entry that points
  // at a file extension the current scanner does not handle — e.g. a
  // `.json` fixture or a future language — because that's a scanner
  // gap, not a stale entry.
  for (const [fileKey, entries] of byFile.entries()) {
    const filtered = entries.filter((e) => {
      if (sourceById.has(e.id)) return true
      if (isTombstone(e)) return true
      // Non-canonical legacy id (e.g. extra segments the scanner can't
      // match) — keep, surface as drift via `check`.
      if (canonicalIdRegex && !canonicalIdRegex.test(e.id)) {
        preserved.push(e.id)
        return true
      }
      const files = e.lists.files ?? (e.scalars.file ? [e.scalars.file] : [])
      const allOutOfScope = files.length > 0 && files.every((f) => {
        const ext = f.includes('.') ? f.slice(f.lastIndexOf('.')) : ''
        return !exts.has(ext)
      })
      if (allOutOfScope) {
        preserved.push(e.id)
        return true
      }
      removed.push(e.id)
      return false
    })
    byFile.set(fileKey, filtered)
  }

  // Update file lists for entries whose source files moved.
  for (const [, entries] of byFile.entries()) {
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
    }
  }

  return {
    updatedFiles: byFile,
    added: added.sort(),
    removed: removed.sort(),
    preserved: preserved.sort(),
  }
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
  const allTypes = /** @type {TagType[]} */ (Object.keys(REGISTRY_TARGETS))
  const selectedTypes = types?.length ? types : allTypes

  // Validate caller-supplied types so a typo doesn't silently no-op.
  if (types?.length) {
    const unknown = types.filter((t) => !REGISTRY_TARGETS[t])
    if (unknown.length) {
      log(`trace sync: unknown type(s): ${unknown.join(', ')}. Expected one of: ${allTypes.join(', ')}`)
      return { exitCode: 1, report: {} }
    }
  }

  const report = /** @type {Record<string, {added: string[], removed: string[], preserved: string[], files: string[]}>} */ ({})

  for (const type of selectedTypes) {
    const target = REGISTRY_TARGETS[type]
    if (!target) continue
    const existing = await loadRegistryDir(repoRoot, target.dir)
    const { updatedFiles, added, removed, preserved } = planSync(
      /** @type {TagType} */ (type),
      scan.byType[type] || [],
      existing,
    )
    const touched = []
    for (const [relPath, entries] of updatedFiles.entries()) {
      const original = existing.find((f) => f.relPath === relPath)
      const originalText = original ? serialiseRegistry(original.entries) : null
      const newText = serialiseRegistry(entries)
      if (originalText === newText) continue
      touched.push(relPath)
      if (apply) await writeRegistry(repoRoot, relPath, entries)
    }
    report[type] = { added, removed, preserved, files: touched }
  }

  for (const [type, info] of Object.entries(report)) {
    if (!info.added.length && !info.removed.length && !info.files.length && !info.preserved.length) {
      continue
    }
    log(`[${type}] added=${info.added.length} removed=${info.removed.length} preserved=${info.preserved.length} files=${info.files.length}`)
    for (const id of info.added) log(`  + ${id}`)
    for (const id of info.removed) log(`  - ${id}`)
    for (const id of info.preserved) log(`  ~ ${id} (out-of-scope file — kept)`)
  }
  if (!apply) log('(dry-run: pass --apply to write changes)')
  return { exitCode: 0, report }
}
