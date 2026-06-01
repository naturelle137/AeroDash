#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * `comment-discipline` — scan source comments for forbidden
 * identifier references (issue/PR numbers, audit-finding IDs).
 *
 * The rule lives in `CLAUDE.md § Code comments`; this script
 * provides the mechanical enforcement. Usage:
 *
 *   node frontend/scripts/comment-discipline/index.mjs           # diff vs baseline; non-zero on NEW findings
 *   node frontend/scripts/comment-discipline/index.mjs --all     # report ALL findings (ignore baseline)
 *   node frontend/scripts/comment-discipline/index.mjs --json    # machine-readable output
 *
 * Wired into `frontend/package.json` as `comment:check`, and into
 * the vitest spec at
 * `frontend/scripts/comment-discipline/__tests__/repo-comment-discipline-gate.spec.ts`
 * so `pnpm test:unit` enforces the ratchet in CI.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { discoverSourceFiles } from './lib/walk.mjs'
import { scanSource } from './lib/scan.mjs'
import { diffAgainstBaseline, loadBaseline, projectFindings } from './lib/baseline.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPO_ROOT = path.resolve(HERE, '..', '..', '..')
const DEFAULT_BASELINE = path.resolve(HERE, 'baseline.json')

/**
 * @param {string} repoRoot
 * @returns {Promise<import('./lib/scan.mjs').scanSource extends (...args: any) => infer R ? R : never>}
 */
export async function buildScanReport(repoRoot) {
  const files = await discoverSourceFiles(repoRoot)
  /** @type {{ file: string, line: number, match: string }[]} */
  const findings = []
  for (const file of files) {
    const abs = path.join(repoRoot, file)
    const source = await readFile(abs, 'utf8')
    for (const finding of scanSource(file, source)) {
      findings.push(finding)
    }
  }
  return findings
}

/**
 * @param {{ repoRoot?: string, baselinePath?: string, all?: boolean }} opts
 */
export async function runCheck({
  repoRoot = DEFAULT_REPO_ROOT,
  baselinePath = DEFAULT_BASELINE,
  all = false,
} = {}) {
  const findings = await buildScanReport(repoRoot)
  const projected = projectFindings(findings)

  if (all) {
    return { exitCode: findings.length === 0 ? 0 : 1, newFindings: findings, allFindings: findings, projected }
  }

  const baseline = await loadBaseline(baselinePath)
  const newFindings = diffAgainstBaseline(projected, baseline, findings)
  return {
    exitCode: newFindings.length === 0 ? 0 : 1,
    newFindings,
    allFindings: findings,
    projected,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const all = args.includes('--all')
  const json = args.includes('--json')
  const { exitCode, newFindings, allFindings } = await runCheck({ all })

  if (json) {
    console.log(JSON.stringify({ newFindings, totalScanned: allFindings.length }, null, 2))
  } else if (exitCode === 0) {
    if (all) {
      console.log(`comment-discipline: 0 forbidden references found (scanned ${allFindings.length} comments).`)
    } else {
      console.log(
        `comment-discipline: no new forbidden references beyond baseline (${allFindings.length} grandfathered).`,
      )
    }
  } else {
    const banner = all ? 'All forbidden references in source comments:' : 'NEW forbidden references in source comments:'
    console.error(`comment-discipline: ${banner}`)
    for (const f of newFindings) {
      console.error(`  ${f.file}:${f.line}  →  ${f.match}`)
    }
    console.error('')
    console.error('Source comments must not embed GitHub issue/PR refs (#N, refs #N, issue-N) or')
    console.error('audit-finding IDs (CS-/DP-/TECH-/PR-/UX-NNN). Put those in the commit message or')
    console.error('PR body. See CLAUDE.md § Code comments. For a genuinely pre-existing entry, run:')
    console.error('  node frontend/scripts/comment-discipline/scripts/regen-baseline.mjs')
  }
  process.exit(exitCode)
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
})()

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err.stack ?? err.message ?? err)
    process.exit(1)
  })
}
