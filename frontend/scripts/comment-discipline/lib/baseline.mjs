/**
 * Baseline ratchet for the comment-discipline check.
 *
 * Pre-existing forbidden-identifier comments (the inventory that
 * sits in the repo before this gate exists) are recorded in
 * `baseline.json` and grandfathered. The gate fails the build only
 * on NEW findings beyond that snapshot — same pattern as
 * `frontend/scripts/trace/baseline-structural.json`.
 *
 * When the sibling cleanup PR removes a baselined comment, the
 * baseline regen script will shrink the snapshot; intentionally
 * adding to the baseline is a review red flag.
 */

import { readFile } from 'node:fs/promises'

/**
 * @typedef {{ file: string, line: number, match: string }} Finding
 * @typedef {{
 *   $comment?: string,
 *   findings: { file: string, match: string, count: number }[],
 * }} Baseline
 */

/**
 * @param {string} baselinePath
 * @returns {Promise<Baseline>}
 */
export async function loadBaseline(baselinePath) {
  try {
    const raw = await readFile(baselinePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.findings)) {
      throw new Error(`baseline file ${baselinePath} missing required "findings" array`)
    }
    return parsed
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
      return { findings: [] }
    }
    throw err
  }
}

/**
 * Reduce raw per-line findings to a stable counted shape so a
 * comment is grandfathered by `(file, match)` rather than by line
 * number — line numbers churn on every edit and that would defeat
 * the ratchet.
 *
 * @param {Finding[]} findings
 * @returns {{ file: string, match: string, count: number }[]}
 */
export function projectFindings(findings) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const f of findings) {
    const key = `${f.file}␟${f.match}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [file, match] = key.split('␟')
      return { file, match, count }
    })
    .sort((a, b) => (a.file === b.file ? a.match.localeCompare(b.match) : a.file.localeCompare(b.file)))
}

/**
 * Compute the new-violations diff: findings present in `current`
 * beyond what `baseline.findings` permits, on a per-`(file, match)`
 * basis. Lower-count regressions are not surfaced — fewer is always
 * fine. Identical or higher counts surface as new violations.
 *
 * @param {{ file: string, match: string, count: number }[]} current
 * @param {Baseline} baseline
 * @returns {Finding[]}  The "what's NEW" set, expanded back into
 *   per-line findings so the report can name a representative line.
 */
export function diffAgainstBaseline(current, baseline, rawFindings) {
  /** @type {Map<string, number>} */
  const allowed = new Map()
  for (const entry of baseline.findings) {
    const key = `${entry.file}␟${entry.match}`
    allowed.set(key, (allowed.get(key) ?? 0) + entry.count)
  }

  /** @type {Map<string, Finding[]>} */
  const rawByKey = new Map()
  for (const f of rawFindings) {
    const key = `${f.file}␟${f.match}`
    if (!rawByKey.has(key)) rawByKey.set(key, [])
    rawByKey.get(key).push(f)
  }

  /** @type {Finding[]} */
  const out = []
  for (const entry of current) {
    const key = `${entry.file}␟${entry.match}`
    const allowedCount = allowed.get(key) ?? 0
    const excess = entry.count - allowedCount
    if (excess <= 0) continue
    const raws = rawByKey.get(key) ?? []
    for (let i = 0; i < excess; i += 1) {
      out.push(raws[i] ?? { file: entry.file, line: 0, match: entry.match })
    }
  }
  return out
}
