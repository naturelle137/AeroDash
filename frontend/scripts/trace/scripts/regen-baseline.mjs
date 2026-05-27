#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Regenerate `frontend/scripts/trace/baseline-structural.json` from the
 * live repo state. Run this after fixing pre-existing structural debt so
 * the gate ratchets downward.
 *
 * Usage (from repo root):
 *   node frontend/scripts/trace/scripts/regen-baseline.mjs
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCheckReport, projectStructuralBaseline } from '../commands/check.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')
const BASELINE_PATH = path.resolve(HERE, '..', 'baseline-structural.json')

async function main() {
  const report = await buildCheckReport(REPO_ROOT)
  const snapshot = projectStructuralBaseline(report)
  const payload = {
    $comment:
      'Pre-existing structural traceability violations grandfathered while the trace graph is cleaned up. ' +
      'Regenerate with: node frontend/scripts/trace/scripts/regen-baseline.mjs. The structural gate fails on any ' +
      'violation beyond this snapshot. See issue #265.',
    duplicates: snapshot.duplicates,
    danglingFromRefs: snapshot.danglingFromRefs,
    registryDrift: snapshot.registryDrift,
  }
  await writeFile(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  const total =
    snapshot.duplicates.length +
    snapshot.danglingFromRefs.length +
    Object.values(snapshot.registryDrift).reduce(
      (n, diff) => n + diff.onlyInSource.length + diff.onlyInRegistry.length + diff.fileMismatches.length,
      0,
    )
  console.log(`Wrote ${path.relative(REPO_ROOT, BASELINE_PATH)} (${total} grandfathered entries).`)
}

main().catch((err) => {
  console.error(err.stack ?? err.message ?? err)
  process.exit(1)
})
