/**
 * `trace tag` — generate a new tag id and insert the comment into a file.
 *
 * Three drivers exist:
 *  - Path-driven inference (`trace tag IMP --file path/to/src.ts`) — the
 *    CLI picks the module/layer from the directory hierarchy.
 *  - Explicit segments (`trace tag IMP MB CORE …`) — used when the file
 *    isn't yet on disk or its path doesn't expose the segments.
 *  - FROM links (`--from REQ-MB-001,REQ-MB-002`) attach upstream parents.
 *
 * Idempotence model: `runTag` only suppresses a write when the *exact*
 * tag id it just computed is already present in the target file (this is
 * what `lib/tag-insert.mjs` guarantees). Running `trace tag IMP --file
 * foo.ts` twice will therefore mint a fresh `…-NNN+1` id on the second
 * call. That is intentional — a file may host several distinct artifacts
 * of the same type — but the CLI emits a heads-up log line when a tag of
 * the same `(type, segments)` already lives in the file so unintended
 * second invocations are easy to spot.
 *
 * The CLI never prompts blocking input in CI: every parameter has a flag
 * equivalent. An interactive prompt is provided for local use via the
 * higher-level `index.mjs` dispatcher.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { scanAll } from '../lib/parser.mjs'
import { nextTagId } from '../lib/id-generator.mjs'
import { assertCanonical, inferSegments } from '../lib/path-inference.mjs'
import { insertTagComment } from '../lib/tag-insert.mjs'

/** @typedef {import('../lib/config.mjs').TagType} TagType */

/**
 * Compute the next sequential id given user-supplied options. The caller
 * never has to know the regex shape — `formatTag` lives behind this.
 *
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {TagType} opts.type
 * @param {string[]} [opts.segments]
 * @param {string} [opts.file]        Optional file path for inference.
 */
export async function computeNextTag({ repoRoot, type, segments, file }) {
  const scan = await scanAll(repoRoot)
  let resolvedSegments = segments
  if (!resolvedSegments?.length) {
    if (!file) throw new Error('Either --segments or --file required for inference')
    resolvedSegments = inferSegments(type, file)
  }
  // Validate canonical segments per STC ontology.
  switch (type) {
    case 'REQ':
      assertCanonical('module', resolvedSegments[0])
      break
    case 'IMP':
    case 'UT':
    case 'IT':
      assertCanonical('module', resolvedSegments[0])
      assertCanonical('layer', resolvedSegments[1])
      break
    case 'UJ':
    case 'E2E':
      assertCanonical('phase', resolvedSegments[0])
      break
    default:
      // H/DES use their own ontology
      break
  }
  return nextTagId(scan.occurrences, type, resolvedSegments)
}

/**
 * Generate the tag and write the comment into the file.
 *
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {TagType} opts.type
 * @param {string} opts.file
 * @param {string[]} [opts.segments]
 * @param {string[]} [opts.fromTags=[]]
 * @param {boolean} [opts.technical=false]
 * @param {number} [opts.lineIndex]
 * @param {boolean} [opts.dryRun=false]
 * @param {(message: string) => void} [opts.log]
 */
export async function runTag({
  repoRoot,
  type,
  file,
  segments,
  fromTags = [],
  technical = false,
  lineIndex,
  dryRun = false,
  log = () => {},
}) {
  const tag = await computeNextTag({ repoRoot, type, segments, file })
  const abs = path.isAbsolute(file) ? file : path.join(repoRoot, file)
  // Comment-style detection is suffix-based; pass the repo-relative path
  // so the rest of the CLI stays internally consistent and Windows path
  // separators in `abs` never confuse downstream helpers.
  const rel = path.relative(repoRoot, abs).replace(/\\/g, '/')
  const text = await readFile(abs, 'utf8')
  // Heads-up when a sibling tag of the same (type, segments) already lives
  // in this file. We don't refuse — a file may legitimately host several
  // distinct artifacts of the same type — but we surface the existing id so
  // accidental double-invocations are visible in the log.
  const siblingRegex = buildSiblingRegex(tag)
  if (siblingRegex && siblingRegex.test(text)) {
    log(
      `${file}: a tag of the same (type, segments) is already present — minting ${tag}. ` +
        `If this is unintended, revert and re-use the existing id.`,
    )
  }
  const { text: newText, alreadyPresent, insertedAt } = insertTagComment({
    fileText: text,
    filePath: rel,
    tag,
    fromTags,
    technical,
    lineIndex,
  })
  if (alreadyPresent) {
    log(`${file}: ${tag} already present (line ${insertedAt}); no changes written.`)
    return { tag, exitCode: 0 }
  }
  if (!dryRun) await writeFile(abs, newText, 'utf8')
  log(`${file}: inserted ${tag} at line ${insertedAt}${dryRun ? ' (dry-run)' : ''}`)
  return { tag, exitCode: 0 }
}

/**
 * Build a `(type, segments)`-scoped sibling regex from a freshly minted
 * tag id. Returns `null` when the input doesn't decompose into the
 * expected `@TYPE-…-NNN@` shape (e.g. malformed callers).
 *
 * Example: `@IMP-MB-CORE-002@` → `/(?<![A-Z0-9-])@IMP-MB-CORE-\d+@(?![A-Z0-9-])/`.
 *
 * @param {string} tag
 * @returns {RegExp|null}
 */
function buildSiblingRegex(tag) {
  const match = /^@([A-Z]+)(?:-(.+))?-(\d+)@$/.exec(tag)
  if (!match) return null
  const [, type, midRaw] = match
  const prefix = midRaw ? `${type}-${midRaw}` : type
  // Escape the prefix in case any segment ever contains a regex metachar.
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Z0-9-])@${escaped}-\\d+@(?![A-Z0-9-])`)
}
