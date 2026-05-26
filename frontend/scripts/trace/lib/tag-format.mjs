/**
 * Pure helpers for formatting and parsing trace tag annotations.
 *
 * STC §3 defines the canonical tag shape `@PREFIX-SEGMENTS@` and the
 * optional `(FROM: @A@, @B@)` / `(TECHNICAL)` annotations. This module
 * centralises those rules so command modules never re-implement them.
 */

/** @typedef {import('./config.mjs').TagType} TagType */

/**
 * @typedef {Object} TagComponents
 * @property {TagType} type
 * @property {string[]} segments  Ordered uppercase segments excluding the number.
 * @property {number} number      Zero-padded sequential integer.
 */

/**
 * @typedef {Object} ParsedAnnotation
 * @property {string[]} fromTags  IDs cited in a FROM clause (e.g. "@REQ-MB-001@").
 * @property {boolean} technical  True when (TECHNICAL) marker is present.
 */

/** Zero-pad a positive integer to at least three digits per STC §3.2. */
export function padNumber(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid tag number: ${n}`)
  }
  return String(n).padStart(3, '0')
}

/**
 * Build a tag id from its components.
 *
 * @example formatTag({ type: 'IMP', segments: ['MB', 'CORE'], number: 1 }) → '@IMP-MB-CORE-001@'
 * @param {TagComponents} c
 * @returns {string}
 */
export function formatTag({ type, segments, number }) {
  if (!type) throw new Error('Tag type required')
  if (segments.some((s) => !/^[A-Z][A-Z0-9]*$/.test(s))) {
    throw new Error(`Tag segments must be uppercase: ${segments.join('-')}`)
  }
  const parts = [type, ...segments, padNumber(number)]
  return `@${parts.join('-')}@`
}

/**
 * Parse a tag id back into its components. Permissive on the trailing
 * number (accepts ≥1 digit) so callers can normalise legacy 2-digit ids.
 *
 * Supports the two structural shapes the STC defines:
 *  - `@H-NNN@` — hazards have no middle segments
 *  - `@<TYPE>-<SEG>(-<SEG>)*-NNN@` — every other type has ≥1 segment
 *
 * @param {string} tag  e.g. "@IMP-MB-CORE-001@" or "@H-006@"
 * @returns {TagComponents}
 */
export function parseTag(tag) {
  const match = /^@([A-Z]+)(?:-(.+))?-(\d+)@$/.exec(tag)
  if (!match) throw new Error(`Malformed tag: ${tag}`)
  const [, type, midRaw, num] = match
  const segments = midRaw ? midRaw.split('-') : []
  return { type: /** @type {TagType} */ (type), segments, number: Number(num) }
}

/**
 * Detect FROM and TECHNICAL annotations on a tag-bearing line.
 *
 * @param {string} line
 * @returns {ParsedAnnotation}
 */
export function parseAnnotations(line) {
  /** @type {ParsedAnnotation} */
  const result = { fromTags: [], technical: false }

  const fromMatch = /\(FROM:\s*([^)]+)\)/.exec(line)
  if (fromMatch) {
    const refs = fromMatch[1].match(/@[A-Z0-9-]+@/g) ?? []
    result.fromTags = refs
  }

  if (/\(TECHNICAL\)/.test(line)) {
    result.technical = true
  }
  return result
}

/**
 * Compose a full tag comment for a given file type. The CLI never guesses
 * the comment syntax — STC §3.4 mandates a fixed mapping.
 *
 * @param {Object} opts
 * @param {string} opts.tag               Already-formatted tag id.
 * @param {string[]} [opts.fromTags=[]]   Upstream parent tags (no leading "@").
 * @param {boolean} [opts.technical=false]
 * @param {'md'|'ts'|'feature'} opts.style
 * @returns {string}
 */
export function buildComment({ tag, fromTags = [], technical = false, style }) {
  if (technical && fromTags.length > 0) {
    throw new Error('A tag cannot be both TECHNICAL and have FROM references')
  }
  let body = tag
  if (technical) body += ' (TECHNICAL)'
  else if (fromTags.length > 0) body += ` (FROM: ${fromTags.join(', ')})`

  switch (style) {
    case 'md':
      return `<!-- ${body} -->`
    case 'ts':
      return `// ${body}`
    case 'feature':
      return `# ${body}`
    default:
      throw new Error(`Unknown comment style: ${style}`)
  }
}

/**
 * Comment-style detector for path-inference. Picks the appropriate comment
 * syntax based on the file extension.
 *
 * Vue single-file components contain both `<template>` (HTML-comment) and
 * `<script>` (`//`) blocks; new tag insertions default to the script-style
 * `//` shape because `tag-insert.mjs` is line-oriented and the script
 * block is the canonical place for new IMP tags (existing template tags
 * are scanned but not authored automatically).
 *
 * @param {string} filePath
 * @returns {'md'|'ts'|'feature'}
 */
export function commentStyleFor(filePath) {
  if (filePath.endsWith('.feature')) return 'feature'
  if (filePath.endsWith('.md')) return 'md'
  return 'ts'
}
