/**
 * Structural traceability gate (hard-fail on regressions).
 *
 * Runs the live `trace check --structural-only` pipeline against the
 * actual repo and asserts that no NEW duplicate-tag / dangling-FROM /
 * registry-drift violation slips past the `baseline-structural.json`
 * snapshot.
 *
 * This is the surface that the v0.3.0-alpha release audit (PR-005, issue
 * #265) called for: pre-v1.0.0 the `Traceability Gate` workflow remains
 * warn-only, but the structural slice is wired into `pnpm test:unit` so
 * CI fails the moment someone reintroduces a structural defect.
 *
 * This file lives outside `frontend/src/` so the trace scanner does not
 * consume it — it is dev-tooling, like the rest of `scripts/trace/`.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildCheckReport,
  diffAgainstBaseline,
  loadStructuralBaseline,
  projectStructuralBaseline,
} from '../commands/check.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')
const BASELINE_PATH = path.resolve(HERE, '..', 'baseline-structural.json')

describe('repo structural traceability gate', () => {
  it('introduces no NEW structural violations beyond the baseline', async () => {
    const report = await buildCheckReport(REPO_ROOT)
    const current = projectStructuralBaseline(report)
    const baseline = await loadStructuralBaseline(BASELINE_PATH)
    const newViolations = diffAgainstBaseline(current, baseline)

    // Vitest's two-arg `expect(value, msg)` is rejected by oxlint's
    // vitest/valid-expect rule, so we hand-format a diagnostic instead.
    const hasNew =
      newViolations.duplicates.length > 0 ||
      newViolations.danglingFromRefs.length > 0 ||
      Object.keys(newViolations.registryDrift).length > 0
    if (hasNew) {
      // eslint-disable-next-line no-console
      console.error(
        '[structural-gate] New structural traceability violations beyond the baseline. ' +
          'Fix the underlying tag/registry conflict, or — if the entry is genuinely pre-existing — ' +
          'regenerate the baseline via `node frontend/scripts/trace/scripts/regen-baseline.mjs`.\n' +
          JSON.stringify(newViolations, null, 2),
      )
    }
    expect(newViolations).toEqual({
      duplicates: [],
      danglingFromRefs: [],
      registryDrift: {},
    })
  }, 30_000)
})
