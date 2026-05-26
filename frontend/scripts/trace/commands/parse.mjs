/**
 * `trace parse` — dump the parsed source-tag graph as JSON.
 *
 * Used by humans for diagnostics and by the CI workflow as the canonical
 * input to invariant checks. Output goes to stdout so callers can pipe it
 * into `jq` or redirect to a file.
 */

import { scanAll } from '../lib/parser.mjs'

/**
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {(message: string) => void} [opts.log]
 * @returns {Promise<{stdout: string, exitCode: number}>}
 */
export async function runParse({ repoRoot, log = () => {} }) {
  const result = await scanAll(repoRoot)
  log(`Parsed ${result.occurrences.length} tag occurrences`)
  const json = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totals: Object.fromEntries(Object.entries(result.byType).map(([k, v]) => [k, v.length])),
      occurrences: result.occurrences,
    },
    null,
    2,
  )
  return { stdout: `${json}\n`, exitCode: 0 }
}
