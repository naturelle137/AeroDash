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
 * @property {boolean} declared    True when the match is the tag's own
 *                                 declaration (bare `@TAG@`), false when it
 *                                 appears inside a `(FROM: …)` citation on a
 *                                 downstream artifact's line. Registry and
 *                                 drift checks only count declarations as
 *                                 the artifact's source file.
 * @property {string} [title]      Human-readable title harvested from the next
 *                                 markdown heading line for document tags
 *                                 (H, REQ, UJ, DES). Empty when no heading is
 *                                 reachable inside the lookahead window or for
 *                                 non-markdown sources.
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
 * Document-level tag types whose markdown source contains a heading line
 * immediately downstream of the tag comment. The CLI uses this set to
 * decide when to harvest a `title:` field for the registry.
 *
 * @type {Set<TagType>}
 */
const TITLE_BEARING_TYPES = new Set(['H', 'REQ', 'UJ', 'DES'])

/**
 * Strip Markdown heading prefixes (`#`, `##`, …), optional HTML anchor
 * wrappers (`<a name="UJ-A-001"></a>`), the id prefix (`UJ-A-001:` /
 * `REQ-MB-001:`), and surrounding whitespace from a heading line.
 *
 * Returns an empty string when the line is not a heading or the residual
 * title is empty — the caller then keeps looking down the file.
 *
 * @param {string} line
 * @returns {string}
 */
export function extractMarkdownTitle(line) {
  const trimmed = line.replace(/\r$/, '').trimEnd()
  // Must start with one or more `#` markers followed by a space.
  const headingMatch = /^#+\s+(.*)$/.exec(trimmed)
  if (!headingMatch) return ''
  let body = headingMatch[1].trim()
  // Drop a leading anchor span — common in journey headings:
  //   ## <a name="UJ-A-001"></a>UJ-A-001: Title
  body = body.replace(/^<a\b[^>]*>\s*<\/a>\s*/i, '').trim()
  // Drop an `ID:` prefix so the title remains the human-readable suffix.
  body = body.replace(/^[A-Z]+(?:-[A-Z0-9]+)+\s*:\s*/, '').trim()
  // Drop any trailing punctuation that would render awkwardly in YAML.
  return body
}

/**
 * Scan forward from the line immediately after a tag comment to find the
 * next markdown heading. Blank lines and HTML-comment continuation lines
 * are skipped so multi-line `<!-- … -->` blocks don't trip the search.
 *
 * @param {string[]} lines             All file lines.
 * @param {number} tagIdx              0-indexed line of the tag comment.
 * @returns {string}                   Title, or '' when none reachable.
 */
function findTitleAfter(lines, tagIdx) {
  // Cap the lookahead so a missing heading on a malformed file doesn't
  // pull the whole document into consideration.
  const limit = Math.min(lines.length, tagIdx + 25)
  for (let i = tagIdx + 1; i < limit; i += 1) {
    const raw = lines[i]
    if (raw == null) break
    const text = raw.trim()
    if (text === '') continue
    if (text.startsWith('<!--') || text.startsWith('-->')) continue
    const title = extractMarkdownTitle(raw)
    if (title) return title
    // First non-blank non-comment line that is not a heading: stop
    // searching — the tag block is over.
    if (!/^#+\s+/.test(text)) return ''
  }
  return ''
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
      const harvestTitle = TITLE_BEARING_TYPES.has(type)
      lines.forEach((line, idx) => {
        if (!cfg.commentRegex.test(line)) return
        // Locate the `(FROM: …)` span so each tag match can be classified
        // as a declaration (bare `@TAG@`) or a citation (inside FROM).
        // Citations must not pollute file-list mismatch reports because a
        // downstream artifact's source file is not the cited tag's home.
        const fromSpan = /\(FROM:\s*[^)]+\)/.exec(line)
        const fromStart = fromSpan ? fromSpan.index : -1
        const fromEnd = fromSpan ? fromSpan.index + fromSpan[0].length : -1
        // Reset lastIndex so a global regex stays stable inside forEach.
        cfg.tagRegex.lastIndex = 0
        let match
        while ((match = cfg.tagRegex.exec(line)) !== null) {
          const id = match[0]
          const segments = match.slice(1, -1).filter((s) => /^[A-Z]+$/.test(s))
          const number = Number(match[match.length - 1])
          const annotations = parseAnnotations(line)
          const declared = fromStart < 0 || match.index < fromStart || match.index >= fromEnd
          /** @type {TagOccurrence} */
          const occ = {
            id,
            type,
            segments,
            number,
            file: path.relative(repoRoot, file).replace(/\\/g, '/'),
            line: idx + 1,
            fromTags: annotations.fromTags,
            technical: annotations.technical,
            declared,
          }
          if (harvestTitle && declared) {
            const title = findTitleAfter(lines, idx)
            if (title) occ.title = title
          }
          occurrences.push(occ)
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
