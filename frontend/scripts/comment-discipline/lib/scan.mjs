/**
 * Comment-discipline scanner.
 *
 * Source of truth for the rule: `CLAUDE.md § Code comments`
 * (mirrored in `CONTRIBUTING.md §4.x Code Comments`). Only the
 * forbidden-identifier slice is mechanically enforced here; the
 * why-only and trace-tag-preferred rules remain reviewer judgment.
 *
 * What counts as a "forbidden identifier" inside a source comment:
 *   - GitHub issue/PR references: `refs #N`, `issue #N`, `Issue #N`,
 *     `closes #N`, `fixes #N`, `resolves #N`, `see #N`,
 *     `spawned by #N`, `part of #N`, `issue-N`
 *   - Audit-finding IDs assigned by the `/audit.*` agents and never
 *     committed to git: `CS-NNN`, `DP-NNN`, `TECH-NNN`, `PR-NNN`,
 *     `UX-NNN` (three-digit form, case-sensitive)
 *
 * The only identifier references *permitted* in source comments are
 * shtracer tags (`@H-/@REQ-/@UJ-/@DES-/@IMP-/@UT-/@IT-/@E2E-`) per
 * `docs/stc.md`. Those tags begin with `@` and so cannot be confused
 * with the forbidden patterns above.
 *
 * The scanner deliberately only inspects COMMENTS. String/template
 * literals containing the same patterns (e.g. a test fixture or a
 * URL string) are inert data and not in scope.
 */

const ISSUE_REF_KEYWORDS_RE =
  /\b(?:refs?|closes?|fixes?|resolves?|see|issue|spawned\s+by|part\s+of)\s*[:.,;-]?\s*#\d+\b/gi

const ISSUE_SLUG_RE = /\bissue-#?\d+\b/gi

// Audit-finding IDs (CS-NNN, DP-NNN, TECH-NNN, PR-NNN, UX-NNN). The
// lookbehind/lookahead exclude shtracer-tag fragments — `UX` shows
// up inside `@DES-UX-013@` and we must not flag that. The dash and
// `@` rejections together guarantee the match is a standalone token,
// not a slice of a longer hyphenated identifier (e.g. trace tag,
// store key) or an `@…@` wrapped tag.
const AUDIT_ID_RE = /(?<![@\w-])(?:CS|DP|TECH|PR|UX)-\d{3}(?![@\w-])/g

/**
 * Comment-extraction state machine. Walks the source character by
 * character so we never misread `//` inside a string literal as a
 * line comment, and conversely never miss a comment because the line
 * also contains a string.
 *
 * Supports: TS/JS line comments (`//`), block comments (`/* … *​/`),
 * single-quote / double-quote / template-string literals, and Vue
 * `<template>` HTML comments (`<!-- … -->`). `<style>` blocks in Vue
 * SFCs are stripped before this runs — CSS hex colours like
 * `#1d4ed8` would otherwise be misread as issue references.
 *
 * @param {string} source
 * @returns {{ text: string, line: number }[]}
 */
export function extractComments(source) {
  /** @type {{ text: string, line: number }[]} */
  const comments = []
  const len = source.length
  let i = 0
  let line = 1

  /** Move `i` past the next newline; keep `line` in sync. */
  const advanceLine = () => {
    if (source[i] === '\n') line += 1
  }

  while (i < len) {
    const c = source[i]
    const next = source[i + 1]

    if (c === '/' && next === '/') {
      const startLine = line
      i += 2
      const start = i
      while (i < len && source[i] !== '\n') i += 1
      comments.push({ text: source.slice(start, i), line: startLine })
      continue
    }

    if (c === '/' && next === '*') {
      const startLine = line
      i += 2
      const start = i
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line += 1
        i += 1
      }
      comments.push({ text: source.slice(start, i), line: startLine })
      i += 2
      continue
    }

    if (c === '<' && source.startsWith('!--', i + 1)) {
      const startLine = line
      i += 4
      const start = i
      while (i < len && !(source[i] === '-' && source[i + 1] === '-' && source[i + 2] === '>')) {
        if (source[i] === '\n') line += 1
        i += 1
      }
      comments.push({ text: source.slice(start, i), line: startLine })
      i += 3
      continue
    }

    if (c === '"' || c === "'") {
      const quote = c
      i += 1
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < len) {
          i += 2
          continue
        }
        if (source[i] === '\n') line += 1
        i += 1
      }
      i += 1
      continue
    }

    if (c === '`') {
      i += 1
      while (i < len && source[i] !== '`') {
        if (source[i] === '\\' && i + 1 < len) {
          i += 2
          continue
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          i += 2
          let depth = 1
          while (i < len && depth > 0) {
            if (source[i] === '{') depth += 1
            else if (source[i] === '}') depth -= 1
            if (source[i] === '\n') line += 1
            i += 1
          }
          continue
        }
        if (source[i] === '\n') line += 1
        i += 1
      }
      i += 1
      continue
    }

    advanceLine()
    i += 1
  }

  return comments
}

/**
 * Strip `<style …>…</style>` blocks from a Vue SFC source so the
 * comment extractor never sees CSS hex colours or selector tokens.
 * Preserves newline count so reported line numbers stay accurate.
 *
 * @param {string} source
 */
export function stripVueStyleBlocks(source) {
  return source.replaceAll(/<style\b[\s\S]*?<\/style>/g, (block) => {
    const newlineCount = (block.match(/\n/g) ?? []).length
    return '\n'.repeat(newlineCount)
  })
}

/**
 * @param {string} commentText
 * @returns {string[]} Forbidden tokens detected in the comment.
 */
export function detectForbiddenInComment(commentText) {
  /** @type {string[]} */
  const hits = []
  for (const re of [ISSUE_REF_KEYWORDS_RE, ISSUE_SLUG_RE, AUDIT_ID_RE]) {
    re.lastIndex = 0
    for (const match of commentText.matchAll(re)) {
      hits.push(match[0])
    }
  }
  return hits
}

/**
 * Scan a single source file.
 *
 * @param {string} relPath  Repo-relative path, used as the report key.
 * @param {string} source
 * @returns {{ file: string, line: number, match: string }[]}
 */
export function scanSource(relPath, source) {
  const prepared = relPath.endsWith('.vue') ? stripVueStyleBlocks(source) : source
  /** @type {{ file: string, line: number, match: string }[]} */
  const findings = []
  for (const comment of extractComments(prepared)) {
    for (const match of detectForbiddenInComment(comment.text)) {
      findings.push({ file: relPath, line: comment.line, match })
    }
  }
  return findings
}
