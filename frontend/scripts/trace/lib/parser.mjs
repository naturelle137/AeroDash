/**
 * Source-of-truth parser.
 *
 * Walks the directories declared in `SCAN_CONFIG`, extracts every
 * traceability tag, captures its FROM/TECHNICAL annotations, and returns
 * a structured object the rest of the CLI consumes. The parser is the only
 * component that touches the filesystem during a scan — every downstream
 * helper works on its return value.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { SCAN_CONFIG, configFor } from './config.mjs'
import { parseAnnotations } from './tag-format.mjs'

/** @typedef {import('./config.mjs').TagType} TagType */

/**
 * @typedef {Object} TagOccurrence
 * @property {string} id           Full tag id (with @ delimiters).
 * @property {TagType} type
 * @property {string[]} segments   Uppercase segments excluding the trailing number.
 * @property {number} number       Trailing sequential integer.
 * @property {string} file         Repo-relative file path.
 * @property {number} line         1-indexed line number of the tag.
 * @property {string[]} fromTags   Upstream parents declared via (FROM: ...).
 * @property {boolean} technical   True iff the line carries the (TECHNICAL) marker.
 */

/**
 * @typedef {Object} ParseResult
 * @property {TagOccurrence[]} occurrences      Every tag found in source files.
 * @property {Record<TagType, TagOccurrence[]>} byType  Occurrences grouped by node type.
 */

/**
 * Determine whether a file matches the config extensions and ignore rules.
 *
 * @param {import('./config.mjs').TagSourceConfig} cfg
 * @param {string} fileName
 * @returns {boolean}
 */
function matchesConfig(cfg, fileName) {
  const ext = cfg.extensions.find((e) => fileName.endsWith(e))
  if (!ext) return false
  if (cfg.ignoreNames?.includes(fileName)) return false
  if (cfg.ignoreSuffix && cfg.ignoreSuffix.test(fileName)) return false
  return true
}

/**
 * Recursively yield every file inside a directory that matches the config.
 *
 * @param {string} dir            Absolute directory.
 * @param {import('./config.mjs').TagSourceConfig} cfg
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir, cfg) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
    // Skip dotfiles/dotdirs (.git, .agent, .archive, …) and node_modules
    // unconditionally. We do NOT consult `.gitignore` or a `.traceignore`
    // file today — any tagged source that lives under an ignored path will
    // be invisible to the scanner. Folders intended to ship tagged content
    // (e.g. `docs/`, `frontend/src/`) must not start with `.`.
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(absolute, cfg)
    } else if (entry.isFile() && matchesConfig(cfg, entry.name)) {
      yield absolute
    }
  }
}

/**
 * Scan a single tag type and collect every occurrence.
 *
 * @param {string} repoRoot
 * @param {TagType} type
 * @returns {Promise<TagOccurrence[]>}
 */
export async function scanType(repoRoot, type) {
  const cfg = configFor(type)
  if (!cfg) throw new Error(`No scan config for type ${type}`)

  /** @type {TagOccurrence[]} */
  const occurrences = []

  for (const rel of cfg.paths) {
    const dir = path.join(repoRoot, rel)
    try {
      const meta = await stat(dir)
      if (!meta.isDirectory()) continue
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') continue
      throw err
    }

    for await (const file of walk(dir, cfg)) {
      const text = await readFile(file, 'utf8')
      const lines = text.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (!cfg.commentRegex.test(line)) return
        // Reset lastIndex so a global regex stays stable inside forEach.
        cfg.tagRegex.lastIndex = 0
        let match
        while ((match = cfg.tagRegex.exec(line)) !== null) {
          const id = match[0]
          const segments = match.slice(1, -1).filter((s) => /^[A-Z]+$/.test(s))
          const number = Number(match[match.length - 1])
          const annotations = parseAnnotations(line)
          occurrences.push({
            id,
            type,
            segments,
            number,
            file: path.relative(repoRoot, file).replace(/\\/g, '/'),
            line: idx + 1,
            fromTags: annotations.fromTags,
            technical: annotations.technical,
          })
        }
      })
    }
  }
  return occurrences
}

/**
 * Scan every tag type in `SCAN_CONFIG` and return the combined result.
 *
 * @param {string} repoRoot
 * @returns {Promise<ParseResult>}
 */
export async function scanAll(repoRoot) {
  /** @type {Record<TagType, TagOccurrence[]>} */
  const byType = /** @type {any} */ ({})
  /** @type {TagOccurrence[]} */
  const occurrences = []
  for (const cfg of SCAN_CONFIG) {
    const list = await scanType(repoRoot, cfg.type)
    byType[cfg.type] = list
    occurrences.push(...list)
  }
  return { occurrences, byType }
}

/**
 * Index occurrences by their `id` for quick lookup. When multiple files
 * declare the same id (an INV-008 violation) the duplicates are recorded
 * as an array under that id.
 *
 * @param {TagOccurrence[]} occurrences
 * @returns {Map<string, TagOccurrence[]>}
 */
export function indexById(occurrences) {
  /** @type {Map<string, TagOccurrence[]>} */
  const map = new Map()
  for (const occ of occurrences) {
    const existing = map.get(occ.id)
    if (existing) existing.push(occ)
    else map.set(occ.id, [occ])
  }
  return map
}
