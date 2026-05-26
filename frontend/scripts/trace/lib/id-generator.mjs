/**
 * Sequential-ID generation across the trace namespace.
 *
 * Per STC §3.2 every tag carries a zero-padded sequential integer that is
 * unique within its `(type, segments)` namespace and is **never reused**
 * after deletion. This module computes the next free number given the
 * occurrences already discovered by the parser.
 */

import { formatTag, parseTag } from './tag-format.mjs'

/** @typedef {import('./parser.mjs').TagOccurrence} TagOccurrence */
/** @typedef {import('./config.mjs').TagType} TagType */

/**
 * Build a namespace key for a tag. Two tags share a namespace iff they
 * have the same `type` and identical leading segments (everything except
 * the trailing number).
 *
 * @param {TagType} type
 * @param {string[]} segments
 * @returns {string}
 */
export function namespaceKey(type, segments) {
  return `${type}::${segments.join('-')}`
}

/**
 * Compute the next sequential number for a namespace.
 *
 * The "never-reuse" guarantee means we take `max(existing) + 1` rather
 * than the first gap — even if a number was deleted, the gap stays.
 *
 * @param {TagOccurrence[]} occurrences   Output of `parser.scanAll`/`scanType`.
 * @param {TagType} type
 * @param {string[]} segments
 * @returns {number}
 */
export function nextNumber(occurrences, type, segments) {
  const key = namespaceKey(type, segments)
  let max = 0
  for (const occ of occurrences) {
    if (occ.type !== type) continue
    if (namespaceKey(occ.type, occ.segments) !== key) continue
    if (occ.number > max) max = occ.number
  }
  return max + 1
}

/**
 * Generate the next tag id in a namespace.
 *
 * @param {TagOccurrence[]} occurrences
 * @param {TagType} type
 * @param {string[]} segments
 * @returns {string}
 */
export function nextTagId(occurrences, type, segments) {
  return formatTag({ type, segments, number: nextNumber(occurrences, type, segments) })
}

/**
 * Resolve a `@TYPE@` placeholder against the current scan results. The
 * caller supplies the file path so we can infer the missing segments; if
 * inference fails, the caller must supply segments explicitly.
 *
 * @param {Object} opts
 * @param {string} opts.placeholder        Placeholder text including the @ delimiters, e.g. "@IMP@".
 * @param {TagOccurrence[]} opts.occurrences
 * @param {string[]} opts.segments         Required, must come from path inference or --module/--layer.
 * @returns {string}                       Newly generated tag id.
 */
export function resolvePlaceholder({ placeholder, occurrences, segments }) {
  const type = /** @type {TagType} */ (placeholder.replaceAll('@', ''))
  if (!type) throw new Error(`Empty placeholder: ${placeholder}`)
  return nextTagId(occurrences, type, segments)
}

/**
 * Replace every `@TYPE@` placeholder in `text` with a freshly generated
 * tag id. Multiple placeholders of the same type get monotonically
 * increasing numbers so a single file may declare several new artifacts.
 *
 * @param {Object} opts
 * @param {string} opts.text
 * @param {TagOccurrence[]} opts.occurrences
 * @param {string[]} opts.segments
 * @returns {{text: string, replacements: Array<{placeholder: string, generated: string}>}}
 */
export function resolvePlaceholders({ text, occurrences, segments }) {
  // We track per-namespace counters so multiple placeholders in the same
  // file don't collide.
  /** @type {Map<string, number>} */
  const counters = new Map()
  /** @type {Array<{placeholder: string, generated: string}>} */
  const replacements = []

  // Placeholder must be `@TYPE@` with TYPE being one of the known node prefixes
  // and not already followed by an extra segment that would make it a complete
  // tag (e.g., `@IMP-MB-CORE-001@`).
  const placeholderRegex = /@(H|REQ|UJ|DES|IMP|UT|IT|E2E)@/g

  const newText = text.replace(placeholderRegex, (match, typeRaw) => {
    const type = /** @type {TagType} */ (typeRaw)
    const key = namespaceKey(type, segments)
    const baseline = nextNumber(occurrences, type, segments)
    const counterOffset = counters.get(key) ?? 0
    const number = baseline + counterOffset
    counters.set(key, counterOffset + 1)
    const generated = formatTag({ type, segments, number })
    replacements.push({ placeholder: match, generated })
    return generated
  })

  return { text: newText, replacements }
}

/**
 * Detect duplicate ids across the scan. Reports every id that occurs in
 * more than one declaration site. Used by the `check` subcommand and unit
 * tests to enforce INV-007 / INV-008.
 *
 * @param {TagOccurrence[]} occurrences
 * @returns {Array<{id: string, files: string[]}>}
 */
export function findDuplicates(occurrences) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map()
  for (const occ of occurrences) {
    const entry = map.get(occ.id)
    if (entry) entry.add(`${occ.file}:${occ.line}`)
    else map.set(occ.id, new Set([`${occ.file}:${occ.line}`]))
  }
  const duplicates = []
  for (const [id, files] of map.entries()) {
    if (files.size > 1) duplicates.push({ id, files: [...files].sort() })
  }
  return duplicates
}

/**
 * Detect dangling FROM references (INV-009). Every id cited in a FROM
 * clause must exist as a defined tag elsewhere in the scan.
 *
 * @param {TagOccurrence[]} occurrences
 * @returns {Array<{from: string, citedBy: string}>}
 */
export function findDanglingFromRefs(occurrences) {
  /** @type {Set<string>} */
  const defined = new Set(occurrences.map((o) => o.id))
  const dangling = []
  for (const occ of occurrences) {
    for (const ref of occ.fromTags) {
      if (!defined.has(ref)) {
        dangling.push({ from: ref, citedBy: `${occ.id} (${occ.file}:${occ.line})` })
      }
    }
  }
  return dangling
}

// Re-export parseTag so command modules don't import two files.
export { parseTag }
