/**
 * Registry I/O for the indent-based YAML files under `trace/`.
 *
 * The legacy format is **not** standard YAML — it is a hand-curated layout
 * with implicit grouping and 2/4/6 space indents (STC §4.3). To keep
 * round-tripping safe (so `sync` doesn't churn unrelated diffs) we read,
 * mutate, and write using a small bespoke parser rather than relying on a
 * generic YAML library.
 *
 * Format:
 *
 *   {Group Title}
 *     {ID}
 *       {scalar-field}: {value}
 *       {list-field}:
 *         - {item}
 *         - {item}
 *
 * Lines starting with `#`, and pure-blank lines, are preserved as
 * structural separators between groups.
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { REGISTRY_TARGETS } from './config.mjs'

/** @typedef {import('./config.mjs').TagType} TagType */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id                Tag id WITHOUT @ delimiters, e.g. "IMP-MB-CORE-001".
 * @property {string} group             Group title the entry belongs to.
 * @property {Record<string,string>} scalars    Scalar fields (title, file, status, note, …).
 * @property {Record<string,string[]>} lists    List fields (req, des, impl, files, …).
 */

/**
 * @typedef {Object} RegistryFile
 * @property {string} relPath           Repo-relative path of the YAML file.
 * @property {RegistryEntry[]} entries
 */

/**
 * Detect whether a line has zero leading whitespace and a non-empty body
 * that doesn't look like a YAML key (i.e. doesn't end in `:`). Such a line
 * starts a new group block.
 */
function isGroupHeader(line) {
  return line.length > 0 && !line.startsWith(' ') && !line.startsWith('#') && !line.endsWith(':')
}

/**
 * Parse a registry file's raw text into `RegistryEntry` records.
 *
 * @param {string} text
 * @returns {RegistryEntry[]}
 */
export function parseRegistry(text) {
  const lines = text.split(/\r?\n/)
  /** @type {RegistryEntry[]} */
  const entries = []
  /** @type {RegistryEntry|null} */
  let entry = null
  /** @type {string|null} */
  let pendingListField = null
  let currentGroup = ''

  for (const raw of lines) {
    if (raw.trim() === '') {
      pendingListField = null
      continue
    }
    if (isGroupHeader(raw)) {
      currentGroup = raw.trim()
      entry = null
      pendingListField = null
      continue
    }

    // Two-space indent → new ID block
    if (/^ {2}[^ ]/.test(raw)) {
      if (entry) entries.push(entry)
      const id = raw.trim()
      entry = { id, group: currentGroup, scalars: {}, lists: {} }
      pendingListField = null
      continue
    }

    if (!entry) continue

    // Four-space indent → field (scalar or list opener)
    if (/^ {4}[^ ]/.test(raw)) {
      const body = raw.slice(4)
      const colonIdx = body.indexOf(':')
      if (colonIdx === -1) continue
      const key = body.slice(0, colonIdx).trim()
      const value = body.slice(colonIdx + 1).trim()
      if (value === '') {
        entry.lists[key] = []
        pendingListField = key
      } else {
        entry.scalars[key] = value
        pendingListField = null
      }
      continue
    }

    // Six-space list item under the current pendingListField
    if (/^ {6}-\s+/.test(raw) && pendingListField) {
      const item = raw.replace(/^ {6}-\s+/, '').trim()
      entry.lists[pendingListField].push(item)
      continue
    }
  }
  if (entry) entries.push(entry)
  return entries
}

/**
 * Serialise registry entries back into the legacy indent format. Entries
 * are grouped by their `group` field; group order follows first-appearance
 * order in `entries`.
 *
 * @param {RegistryEntry[]} entries
 * @returns {string}
 */
export function serialiseRegistry(entries) {
  const out = []
  const byGroup = new Map()
  for (const e of entries) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, [])
    byGroup.get(e.group).push(e)
  }
  let first = true
  for (const [group, items] of byGroup.entries()) {
    if (!first) out.push('')
    first = false
    out.push(group)
    items.forEach((entry, idx) => {
      if (idx > 0) out.push('')
      out.push(`  ${entry.id}`)
      for (const [k, v] of Object.entries(entry.scalars)) {
        out.push(`    ${k}: ${v}`)
      }
      for (const [k, items] of Object.entries(entry.lists)) {
        out.push(`    ${k}:`)
        for (const item of items) out.push(`      - ${item}`)
      }
    })
  }
  return `${out.join('\n')}\n`
}

/**
 * Recursively load every `.yaml` file under a directory, returning their
 * parsed entries together with the relative file path.
 *
 * @param {string} repoRoot
 * @param {string} relDir       e.g. "trace/implementation"
 * @returns {Promise<RegistryFile[]>}
 */
export async function loadRegistryDir(repoRoot, relDir) {
  const dir = path.join(repoRoot, relDir)
  /** @type {RegistryFile[]} */
  const files = []
  try {
    const meta = await stat(dir)
    if (!meta.isDirectory()) return files
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return files
    throw err
  }
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.yaml')) continue
    const abs = path.join(dir, name)
    const text = await readFile(abs, 'utf8')
    files.push({
      relPath: path.join(relDir, name).replace(/\\/g, '/'),
      entries: parseRegistry(text),
    })
  }
  return files
}

/**
 * Write a registry file to disk, creating parents as needed.
 *
 * @param {string} repoRoot
 * @param {string} relPath
 * @param {RegistryEntry[]} entries
 */
export async function writeRegistry(repoRoot, relPath, entries) {
  const abs = path.join(repoRoot, relPath)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, serialiseRegistry(entries), 'utf8')
}

/**
 * Build an index of every registry entry across every YAML file for a
 * given tag type. The key is the bare id (no `@` delimiters).
 *
 * @param {string} repoRoot
 * @param {TagType} type
 * @returns {Promise<Map<string, {entry: RegistryEntry, relPath: string}>>}
 */
export async function loadIndexedRegistry(repoRoot, type) {
  const target = REGISTRY_TARGETS[type]
  /** @type {Map<string, {entry: RegistryEntry, relPath: string}>} */
  const index = new Map()
  if (!target) return index
  const files = await loadRegistryDir(repoRoot, target.dir)
  for (const file of files) {
    for (const entry of file.entries) {
      index.set(entry.id, { entry, relPath: file.relPath })
    }
  }
  return index
}

/**
 * Drift analysis between source-of-truth occurrences and the existing
 * registry index. Reports entries that exist only in source, only in the
 * registry, and id collisions where a registry entry references a file
 * that the parser did not see.
 *
 * @param {import('./parser.mjs').TagOccurrence[]} occurrences
 * @param {Map<string, {entry: RegistryEntry, relPath: string}>} registryIndex
 * @returns {{
 *   onlyInSource: string[],
 *   onlyInRegistry: string[],
 *   fileMismatches: Array<{id: string, sourceFiles: string[], registryFiles: string[]}>,
 * }}
 */
export function diffRegistry(occurrences, registryIndex) {
  const sourceFilesById = new Map()
  for (const occ of occurrences) {
    const bareId = occ.id.replaceAll('@', '')
    if (!sourceFilesById.has(bareId)) sourceFilesById.set(bareId, new Set())
    sourceFilesById.get(bareId).add(occ.file)
  }

  /** @type {string[]} */
  const onlyInSource = []
  /** @type {string[]} */
  const onlyInRegistry = []
  /** @type {Array<{id: string, sourceFiles: string[], registryFiles: string[]}>} */
  const fileMismatches = []

  for (const [id, files] of sourceFilesById.entries()) {
    const reg = registryIndex.get(id)
    if (!reg) {
      onlyInSource.push(id)
      continue
    }
    if (reg.entry.scalars.status === 'deleted' || reg.entry.scalars.status === 'obsolete') {
      // Allowed: registry kept a tombstone for an id that still appears
      // in source. The check command surfaces this as a separate warning.
      continue
    }
    const registryFiles = (reg.entry.lists.files || (reg.entry.scalars.file ? [reg.entry.scalars.file] : []))
      .map((s) => s.trim())
      .filter(Boolean)
    if (registryFiles.length === 0) continue
    const sourceList = [...files].sort()
    const registryList = [...registryFiles].sort()
    const sameMembers = sourceList.length === registryList.length
      && sourceList.every((f, idx) => f === registryList[idx])
    if (!sameMembers) {
      fileMismatches.push({ id, sourceFiles: sourceList, registryFiles: registryList })
    }
  }

  for (const [id, { entry }] of registryIndex.entries()) {
    if (sourceFilesById.has(id)) continue
    if (entry.scalars.status === 'deleted' || entry.scalars.status === 'obsolete') continue
    onlyInRegistry.push(id)
  }

  return {
    onlyInSource: onlyInSource.sort(),
    onlyInRegistry: onlyInRegistry.sort(),
    fileMismatches: fileMismatches.sort((a, b) => a.id.localeCompare(b.id)),
  }
}

/**
 * Generate a deterministic registry entry skeleton for a newly-discovered
 * tag. Used by `sync --apply` to add stubs the developer then fills in.
 *
 * @param {import('./parser.mjs').TagOccurrence} occ
 * @returns {RegistryEntry}
 */
export function entryFromOccurrence(occ) {
  const bareId = occ.id.replaceAll('@', '')
  /** @type {RegistryEntry} */
  const entry = {
    id: bareId,
    group: `${occ.segments[0] ?? occ.type} (auto)`,
    scalars: { title: 'TODO: describe this artifact' },
    lists: { files: [occ.file] },
  }
  // Map FROM annotations into the appropriate list field.
  const reqRefs = occ.fromTags.filter((t) => t.startsWith('@REQ-')).map((t) => t.replaceAll('@', ''))
  const desRefs = occ.fromTags.filter((t) => t.startsWith('@DES-')).map((t) => t.replaceAll('@', ''))
  const impRefs = occ.fromTags.filter((t) => t.startsWith('@IMP-')).map((t) => t.replaceAll('@', ''))
  const hazardRefs = occ.fromTags.filter((t) => t.startsWith('@H-')).map((t) => t.replaceAll('@', ''))
  const ujRefs = occ.fromTags.filter((t) => t.startsWith('@UJ-')).map((t) => t.replaceAll('@', ''))

  switch (occ.type) {
    case 'IMP':
      if (reqRefs.length) entry.lists.req = reqRefs
      if (desRefs.length) entry.lists.des = desRefs
      break
    case 'UT':
    case 'IT':
      if (impRefs.length) entry.lists.impl = impRefs
      break
    case 'REQ':
      if (hazardRefs.length) entry.lists.hazard = hazardRefs
      break
    case 'UJ':
      if (reqRefs.length) entry.lists.req = reqRefs
      break
    case 'DES':
      if (reqRefs.length) entry.lists.req = reqRefs
      break
    case 'E2E':
      // E2E carries no upstream list — UJ trace lives in the .feature file.
      if (ujRefs.length) entry.lists.uj = ujRefs
      break
    default:
      break
  }
  return entry
}
