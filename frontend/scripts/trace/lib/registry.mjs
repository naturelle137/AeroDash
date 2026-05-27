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
 * @typedef {{kind: 'scalar', key: string, value: string} | {kind: 'list', key: string, value: string[]}} RegistryField
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id                Tag id WITHOUT @ delimiters, e.g. "IMP-MB-CORE-001".
 * @property {string} group             Group title the entry belongs to.
 * @property {Record<string,string>} scalars    Scalar fields (title, file, status, note, …).
 * @property {Record<string,string[]>} lists    List fields (req, des, impl, files, …).
 * @property {RegistryField[]} [fields]  Ordered field list as the source declared them.
 *                                       When present, `serialiseRegistry` replays this order
 *                                       instead of "all scalars then all lists" — that keeps
 *                                       interleaved layouts (e.g. `title:` → `req:` → `file:`
 *                                       in `trace/design/arch.yaml`) byte-stable across
 *                                       parse → serialise → parse round-trips (review M1).
 *                                       Constructed entries (from `entryFromOccurrence`) may
 *                                       omit this; the serialiser then falls back to
 *                                       scalars-then-lists.
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

  // Push the in-progress entry into the registry. Used both when a new ID
  // line starts AND when a group header arrives — the latter previously
  // dropped the last entry of every non-terminal group (review B1).
  const flushEntry = () => {
    if (entry) {
      entries.push(entry)
      entry = null
    }
  }

  for (const raw of lines) {
    if (raw.trim() === '') {
      pendingListField = null
      continue
    }
    if (isGroupHeader(raw)) {
      flushEntry()
      currentGroup = raw.trim()
      pendingListField = null
      continue
    }

    // Two-space indent → new ID block
    if (/^ {2}[^ ]/.test(raw)) {
      flushEntry()
      const id = raw.trim()
      entry = { id, group: currentGroup, scalars: {}, lists: {}, fields: [] }
      pendingListField = null
      continue
    }

    if (!entry) continue

    // Four-space indent → field (scalar or list opener)
    if (/^ {4}[^ ]/.test(raw)) {
      const body = raw.slice(4)
      const colonIdx = body.indexOf(':')
      if (colonIdx === -1) {
        // Legacy STC §5.2 tombstones were authored as a bare keyword
        // (e.g. `    obsolete`) rather than `status: obsolete`. We
        // canonicalise so `sync` recognises the tombstone instead of
        // silently dropping the line and removing the entry.
        const flat = body.trim()
        if (flat === 'obsolete' || flat === 'deleted' || flat === 'pending') {
          entry.scalars.status = flat
          entry.fields.push({ kind: 'scalar', key: 'status', value: flat })
        }
        pendingListField = null
        continue
      }
      const key = body.slice(0, colonIdx).trim()
      const value = body.slice(colonIdx + 1).trim()
      if (value === '') {
        const items = /** @type {string[]} */ ([])
        entry.lists[key] = items
        entry.fields.push({ kind: 'list', key, value: items })
        pendingListField = key
      } else {
        entry.scalars[key] = value
        entry.fields.push({ kind: 'scalar', key, value })
        pendingListField = null
      }
      continue
    }

    // Six-space list item under the current pendingListField
    if (/^ {6}-\s+/.test(raw) && pendingListField) {
      const item = raw.replace(/^ {6}-\s+/, '').trim()
      entry.lists[pendingListField].push(item)
      // No fields.push needed — list items live inside the existing list
      // field's `value` array, which is shared by reference.
      continue
    }
  }
  flushEntry()

  // Defensive m1: a non-empty input that produces zero entries means the
  // file uses an indentation/format the parser does not understand. Refuse
  // silently — let the caller decide. Throwing here protects `sync --apply`
  // from blanking a tab-indented (or otherwise-spaced) file with an empty
  // serialisation.
  if (entries.length === 0 && text.trim().length > 0) {
    throw new Error(
      'parseRegistry: input is non-empty but no entries were extracted. '
      + 'Check indentation (2/4/6 spaces) and that ID lines begin at column 3.',
    )
  }
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
  for (const [group, groupEntries] of byGroup.entries()) {
    if (!first) out.push('')
    first = false
    out.push(group)
    groupEntries.forEach((entry, idx) => {
      if (idx > 0) out.push('')
      out.push(`  ${entry.id}`)
      // When parseRegistry built this entry, `fields` preserves the source
      // declaration order so a file that interleaves scalar→list→scalar
      // (e.g. `trace/design/arch.yaml`) round-trips byte-stably. New
      // entries from `entryFromOccurrence` lack `fields`; fall back to
      // scalars-then-lists order (review M1).
      if (entry.fields && entry.fields.length > 0) {
        for (const field of entry.fields) {
          if (field.kind === 'scalar') {
            out.push(`    ${field.key}: ${field.value}`)
          } else {
            out.push(`    ${field.key}:`)
            for (const item of field.value) out.push(`      - ${item}`)
          }
        }
      } else {
        for (const [k, v] of Object.entries(entry.scalars)) {
          out.push(`    ${k}: ${v}`)
        }
        for (const [k, listItems] of Object.entries(entry.lists)) {
          out.push(`    ${k}:`)
          for (const item of listItems) out.push(`      - ${item}`)
        }
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
 * Single tombstone predicate. Keep this aligned with `PRESERVE_STATUSES`
 * in `commands/sync.mjs` — `sync` would otherwise preserve a `pending`
 * entry while `check`'s drift report flagged it as `onlyInRegistry`
 * (review M2). Exported so consumers don't drift again.
 *
 * @param {RegistryEntry} entry
 * @returns {boolean}
 */
export function isTombstone(entry) {
  const status = entry.scalars.status
  return status === 'deleted' || status === 'obsolete' || status === 'pending'
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
    // Citations inside `(FROM: …)` do not declare the tag and must not
    // be reported as a competing source file. Pre-fix, a REQ-AD-020
    // cited from three downstream files registered as a 4-way file
    // mismatch even though the registry pointed at the actual home.
    if (occ.declared === false) continue
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
    if (isTombstone(reg.entry)) {
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
    if (isTombstone(entry)) continue
    onlyInRegistry.push(id)
  }

  return {
    onlyInSource: onlyInSource.sort(),
    onlyInRegistry: onlyInRegistry.sort(),
    fileMismatches: fileMismatches.sort((a, b) => a.id.localeCompare(b.id)),
  }
}

/**
 * Friendly per-module group titles for REQ entries. Falls back to
 * `<MODULE> Requirements` when the module is unknown — keeps the
 * registry self-describing without needing a curator pass for any
 * future module addition.
 */
const REQ_GROUP_TITLES = {
  AC: 'Aircraft Management Requirements',
  AP: 'Airport Database Requirements',
  AD: 'Detailed Aircraft Data Requirements',
  FE: 'Fuel & Endurance Requirements',
  MB: 'Mass & Balance Requirements',
  PF: 'Performance Requirements',
  WX: 'Weather & Meteorological Data Requirements',
  UI: 'User Interface Requirements',
  UQ: 'Usability & Quality Requirements',
  SYS: 'System Requirements',
  DOC: 'Documentation & Export Requirements',
  SC: 'Cloud Sync & Collaboration Requirements',
}

/**
 * Friendly per-phase group titles for UJ entries.
 */
const UJ_GROUP_TITLES = {
  A: 'Phase A — Fleet Management & Setup',
  B: 'Phase B — Flight Preparation',
  C: 'Phase C — Performance & Safety',
  D: 'Phase D — System & Usability',
  E: 'Phase E — Weather & Environment',
  F: 'Phase F — Fuel & Endurance',
  G: 'Phase G — Onboarding & Sync',
  STRESS: 'Stress-Test Journeys',
}

/**
 * Subtype titles for DES entries (currently only ARCH and UX are in use).
 */
const DES_GROUP_TITLES = {
  ARCH: 'Architecture Design',
  UX: 'UX Design',
  API: 'API Design',
}

/**
 * Resolve the curated group label for a newly-discovered occurrence, or
 * synthesise a deterministic fallback that survives a future module/phase
 * addition without manual editing.
 *
 * @param {import('./parser.mjs').TagOccurrence} occ
 */
function groupTitleFor(occ) {
  const key = occ.segments[0] ?? occ.type
  switch (occ.type) {
    case 'REQ':
      return REQ_GROUP_TITLES[key] ?? `${key} Requirements`
    case 'UJ':
      return UJ_GROUP_TITLES[key] ?? `Phase ${key} Journeys`
    case 'DES':
      return DES_GROUP_TITLES[key] ?? `${key} Design`
    default:
      return `${key} (auto)`
  }
}

/**
 * Generate a deterministic registry entry skeleton for a newly-discovered
 * tag. Used by `sync --apply` to add stubs the developer then fills in.
 *
 * Document-level types (REQ, UJ, DES) carry a single `file:` scalar per
 * STC §4.3.1 and use the markdown heading title harvested by the parser
 * when available. Code-level types (IMP, UT, IT, E2E) carry a `files:`
 * list to allow co-located tag declarations across multiple sources.
 *
 * @param {import('./parser.mjs').TagOccurrence} occ
 * @returns {RegistryEntry}
 */
export function entryFromOccurrence(occ) {
  const bareId = occ.id.replaceAll('@', '')
  const isDocumentLevel = occ.type === 'REQ' || occ.type === 'UJ' || occ.type === 'DES'
  const title = (occ.title && occ.title.trim()) || 'TODO: describe this artifact'
  /** @type {RegistryEntry} */
  const entry = {
    id: bareId,
    group: groupTitleFor(occ),
    scalars: { title },
    lists: {},
  }
  if (isDocumentLevel) {
    entry.scalars.file = occ.file
  } else {
    entry.lists.files = [occ.file]
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
      // Hazard refs on IMPs (e.g. `(FROM: @REQ-MB-001@, @H-007@)`) were
      // silently dropped pre-fix because the IMP branch only mapped
      // req/des. Surface them on the same `hazard:` list shape REQ uses
      // (review m4-registry).
      if (hazardRefs.length) entry.lists.hazard = hazardRefs
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
