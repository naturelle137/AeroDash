/**
 * Pure tag-insertion helper.
 *
 * Inserts a tag-bearing comment at a specific 1-indexed line in a file's
 * text without mutating the filesystem — useful for unit tests and dry-
 * runs. The caller decides what to write back to disk.
 */

import { buildComment, commentStyleFor } from './tag-format.mjs'

/**
 * @typedef {Object} TagInsertOptions
 * @property {string} fileText                 Current file contents.
 * @property {string} filePath                 Used to infer comment style.
 * @property {string} tag                      Already-formatted tag id, e.g. "@IMP-MB-CORE-002@".
 * @property {string[]} [fromTags=[]]
 * @property {boolean} [technical=false]
 * @property {number} [lineIndex]              1-indexed insertion line. When omitted, the comment is appended at end-of-file.
 * @property {'before'|'after'} [placement='before']  Insert above or below the target line.
 */

/**
 * Insert the trace comment and return the new file text. Idempotent: if
 * the exact comment text already sits at the insertion site, the original
 * text is returned unchanged.
 *
 * @param {TagInsertOptions} opts
 * @returns {{text: string, insertedAt: number, alreadyPresent: boolean}}
 */
export function insertTagComment(opts) {
  const {
    fileText,
    filePath,
    tag,
    fromTags = [],
    technical = false,
    lineIndex,
    placement = 'before',
  } = opts

  const style = commentStyleFor(filePath)
  const comment = buildComment({ tag, fromTags, technical, style })
  const lines = fileText.split(/\r?\n/)
  // Detect existing tag — keeps the operation idempotent. We compare
  // against the bare tag id rather than the full comment so we don't
  // double-insert if the developer typed a slightly different annotation.
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(tag)) {
      return { text: fileText, insertedAt: i + 1, alreadyPresent: true }
    }
  }

  if (lineIndex == null) {
    const sep = fileText.endsWith('\n') ? '' : '\n'
    return {
      text: `${fileText}${sep}${comment}\n`,
      insertedAt: lines.length + (sep ? 1 : 0),
      alreadyPresent: false,
    }
  }

  if (lineIndex < 1 || lineIndex > lines.length + 1) {
    throw new Error(`lineIndex ${lineIndex} out of range (1..${lines.length + 1})`)
  }

  const insertIdx = placement === 'before' ? lineIndex - 1 : lineIndex
  lines.splice(insertIdx, 0, comment)
  return { text: lines.join('\n'), insertedAt: insertIdx + 1, alreadyPresent: false }
}
