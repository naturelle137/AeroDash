#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Regenerate `frontend/scripts/comment-discipline/baseline.json`
 * from the live repo state. Run after a cleanup pass removes
 * pre-existing forbidden-identifier comments so the ratchet
 * tightens. Adding to the baseline without a written PR-body
 * explanation is a review red flag.
 *
 * Usage (from repo root):
 *   node frontend/scripts/comment-discipline/scripts/regen-baseline.mjs
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildScanReport } from '../index.mjs'
import { projectFindings } from '../lib/baseline.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')
const BASELINE_PATH = path.resolve(HERE, '..', 'baseline.json')

async function main() {
  const findings = await buildScanReport(REPO_ROOT)
  const projected = projectFindings(findings)
  const payload = {
    $comment:
      'Grandfathered forbidden-identifier comments — see CLAUDE.md § Code comments. ' +
      'Regenerate via: node frontend/scripts/comment-discipline/scripts/regen-baseline.mjs. ' +
      'The gate fails on any NEW reference beyond this snapshot; the snapshot only shrinks ' +
      'unless a coordinated cleanup PR documents why it grows.',
    findings: projected,
  }
  await writeFile(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `Wrote ${path.relative(REPO_ROOT, BASELINE_PATH)} ` +
      `(${projected.length} unique (file, match) entries, ${findings.length} raw findings).`,
  )
}

main().catch((err) => {
  console.error(err.stack ?? err.message ?? err)
  process.exit(1)
})
