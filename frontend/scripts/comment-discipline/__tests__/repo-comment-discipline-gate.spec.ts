/**
 * Comment-discipline gate (hard-fail on regressions).
 *
 * Runs the live `comment-discipline` scanner against the actual
 * repo and asserts no NEW forbidden-identifier comment slips past
 * the `baseline.json` snapshot. Same shape as the trace structural
 * gate at `frontend/scripts/trace/__tests__/repo-structural-gate.spec.ts`.
 *
 * Rule source: `CLAUDE.md § Code comments` and
 * `CONTRIBUTING.md §4.x Code Comments`.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { runCheck } from '../index.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')
const BASELINE_PATH = path.resolve(HERE, '..', 'baseline.json')

describe('repo comment-discipline gate', () => {
  it('introduces no NEW forbidden-identifier source comments beyond the baseline', async () => {
    const { newFindings, exitCode } = await runCheck({
      repoRoot: REPO_ROOT,
      baselinePath: BASELINE_PATH,
    })
    if (newFindings.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        '[comment-discipline-gate] New forbidden-identifier references in source comments.\n' +
          'Source comments must not embed GitHub issue/PR refs or audit-finding IDs ' +
          '(see CLAUDE.md § Code comments). If the comment is genuinely pre-existing, ' +
          'regenerate the baseline via `node frontend/scripts/comment-discipline/scripts/regen-baseline.mjs`.\n' +
          JSON.stringify(newFindings, null, 2),
      )
    }
    expect(newFindings).toEqual([])
    expect(exitCode).toBe(0)
  }, 30_000)
})
