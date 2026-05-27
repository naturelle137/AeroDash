/**
 * Hazard → mitigating-requirement inversion + deprecation gate.
 *
 * The trace parser knows that requirements may cite a hazard via
 * `(FROM: @H-xxx@)`, but it has no notion of REQ *status*. Pre-issue-#267
 * the safety-traceability chain therefore could not catch the failure mode
 * called out in the v0.3.0-alpha release audit (PR-009): if the only
 * requirement mitigating a hazard was later moved to `Status: Deprecated`,
 * the hazard would silently regress to *un-mitigated* with nothing flagging
 * it. This module supplies the missing inversion:
 *
 *   1. Scan every REQ tag declaration in `docs/requirements/`.
 *   2. Extract the `**Status:**` line from the requirement's markdown
 *      body so a deprecated REQ can be excluded.
 *   3. Build a map `hazardId → mitigating-REQ ids`, filtering out
 *      deprecated REQs.
 *   4. Compare the result against every declared `@H-…@` tag and report
 *      any hazard whose set of non-deprecated mitigators is empty.
 *
 * The result feeds both `pnpm trace check` and the dedicated
 * `hazard-mitigation.spec.ts` unit-test gate (issue #267 / hazard CI
 * assertion), so a un-mitigated hazard fails the unit-test suite the
 * same way a duplicate tag or registry drift does.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { scanType } from './parser.mjs'

/** @typedef {import('./parser.mjs').TagOccurrence} TagOccurrence */

/**
 * Markdown status keywords (per docs/requirements/README.md). A hazard is
 * mitigated only when at least one REQ in `ACTIVE_STATUSES` cites it.
 * `Deprecated` is intentionally excluded — that is the bug class issue
 * #267 closes.
 */
export const ACTIVE_STATUSES = new Set(['Draft', 'Review', 'Approved', 'Implemented'])
export const DEPRECATED_STATUS = 'Deprecated'

/**
 * Cap the lookahead when searching for a REQ's `**Status:**` line. A
 * canonical block in `docs/requirements/*.md` is ~10 lines; 30 gives
 * generous slack without crossing into the next REQ.
 */
const STATUS_LOOKAHEAD_LINES = 30

/**
 * Extract the `**Status:** …` value sitting beneath a `@REQ-…@` declaration.
 * Returns `null` when no status block is reachable inside the lookahead
 * window — the caller treats that as "unknown", which is intentionally
 * conservative: unknown is **not** deprecated, so the hazard chain stays
 * intact.
 *
 * @param {string[]} lines    File content split on `\r?\n`.
 * @param {number} tagLineIdx 0-indexed line of the `<!-- @REQ-…@ … -->` comment.
 * @returns {string|null}
 */
export function statusAfter(lines, tagLineIdx) {
  const limit = Math.min(lines.length, tagLineIdx + STATUS_LOOKAHEAD_LINES + 1)
  for (let i = tagLineIdx + 1; i < limit; i += 1) {
    const raw = lines[i]
    if (raw == null) break
    const match = /^\*\*Status:\*\*\s*(\S.*)$/.exec(raw.trim())
    if (match) return match[1].trim()
  }
  return null
}

/**
 * @typedef {Object} HazardInversion
 * @property {Map<string, Set<string>>} hazardToActiveReqs    H-id → bare REQ ids in an active status.
 * @property {Map<string, Set<string>>} hazardToDeprecatedReqs H-id → bare REQ ids whose status is Deprecated.
 * @property {Map<string, string>} reqStatuses                 Bare REQ id → trimmed status string.
 */

/**
 * Build the full hazard-mitigation inversion by walking the REQ scan and
 * pulling each REQ's status from its markdown body. The function is
 * deliberately side-effect-free — both `trace check` and the unit-test
 * gate consume the same return value.
 *
 * @param {string} repoRoot
 * @returns {Promise<HazardInversion>}
 */
export async function buildHazardInversion(repoRoot) {
  const reqOccurrences = await scanType(repoRoot, 'REQ')
  /** @type {Map<string, Set<string>>} */
  const hazardToActiveReqs = new Map()
  /** @type {Map<string, Set<string>>} */
  const hazardToDeprecatedReqs = new Map()
  /** @type {Map<string, string>} */
  const reqStatuses = new Map()

  // Re-read each markdown file just once even when it declares many REQs.
  /** @type {Map<string, string[]>} */
  const fileCache = new Map()
  /**
   * @param {string} relFile
   */
  async function loadLines(relFile) {
    const cached = fileCache.get(relFile)
    if (cached) return cached
    const text = await readFile(path.join(repoRoot, relFile), 'utf8')
    const lines = text.split(/\r?\n/)
    fileCache.set(relFile, lines)
    return lines
  }

  for (const occ of reqOccurrences) {
    if (occ.declared === false) continue
    const lines = await loadLines(occ.file)
    const status = statusAfter(lines, occ.line - 1)
    const bareReq = occ.id.replaceAll('@', '')
    if (status) reqStatuses.set(bareReq, status)
    const hazardRefs = occ.fromTags
      .filter((t) => t.startsWith('@H-'))
      .map((t) => t.replaceAll('@', ''))
    if (!hazardRefs.length) continue
    const bucket = status === DEPRECATED_STATUS ? hazardToDeprecatedReqs : hazardToActiveReqs
    for (const hazardId of hazardRefs) {
      if (!bucket.has(hazardId)) bucket.set(hazardId, new Set())
      bucket.get(hazardId).add(bareReq)
    }
  }

  return { hazardToActiveReqs, hazardToDeprecatedReqs, reqStatuses }
}

/**
 * @typedef {Object} UnmitigatedHazard
 * @property {string} hazardId                  Bare H id, e.g. "H-004".
 * @property {string[]} deprecatedMitigators    REQ ids that cite the hazard but are Deprecated.
 */

/**
 * Find every declared hazard with no non-deprecated mitigating REQ. Issue
 * #267 / DoD: "CI fails on an un-mitigated hazard". A hazard counts as
 * un-mitigated when:
 *
 *  - No REQ in `Draft`/`Review`/`Approved`/`Implemented` status cites it
 *    via `FROM:`, AND
 *  - The hazard itself is still declared in `docs/risk_management/`.
 *
 * The returned `deprecatedMitigators` list is purely diagnostic — it lets
 * the failing-test message explain *why* the hazard regressed, so a
 * reviewer can re-attach a fresh REQ rather than dig through every
 * requirement file.
 *
 * @param {string} repoRoot
 * @returns {Promise<{
 *   unmitigated: UnmitigatedHazard[],
 *   hazardIds: string[],
 *   inversion: HazardInversion,
 * }>}
 */
export async function findUnmitigatedHazards(repoRoot) {
  const hazardOccurrences = await scanType(repoRoot, 'H')
  const inversion = await buildHazardInversion(repoRoot)
  /** @type {string[]} */
  const hazardIds = []
  const seen = new Set()
  for (const occ of hazardOccurrences) {
    if (occ.declared === false) continue
    const bareH = occ.id.replaceAll('@', '')
    if (seen.has(bareH)) continue
    seen.add(bareH)
    hazardIds.push(bareH)
  }
  hazardIds.sort()
  /** @type {UnmitigatedHazard[]} */
  const unmitigated = []
  for (const hazardId of hazardIds) {
    const active = inversion.hazardToActiveReqs.get(hazardId)
    if (active && active.size > 0) continue
    const deprecated = inversion.hazardToDeprecatedReqs.get(hazardId)
    unmitigated.push({
      hazardId,
      deprecatedMitigators: deprecated ? [...deprecated].sort() : [],
    })
  }
  return { unmitigated, hazardIds, inversion }
}
