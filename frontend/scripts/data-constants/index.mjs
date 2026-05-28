#!/usr/bin/env node
/* eslint-disable no-console -- CLI entry point: stdout/stderr is the interface (mirrors scripts/trace/index.mjs). */
/**
 * Data-constants gate CLI.
 *
 * Validates docs/data_constants/registry.json (schema, citation, staleness) and
 * exits non-zero on any violation. Code-vs-registry drift is enforced by the
 * Vitest spec (frontend/scripts/data-constants/__tests__/registry-gate.spec.ts)
 * which runs in `pnpm test:unit` and therefore CI. See README.md (#275).
 *
 * Usage: node scripts/data-constants/index.mjs   (pnpm --filter frontend check:data-constants)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadRegistry, validateRegistry } from './lib/registry.mjs'

// index.mjs lives at frontend/scripts/data-constants/index.mjs → repo root is 3 up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

async function main() {
  const registry = await loadRegistry(REPO_ROOT)
  const report = validateRegistry(registry, new Date())

  if (report.ok) {
    console.log(
      `data-constants: OK — ${registry.constants.length} entries cited, in-schema, and current.`,
    )
    return
  }

  console.error('data-constants gate FAILED:')
  for (const e of report.schemaErrors) console.error(`  schema:  ${e}`)
  for (const id of report.uncited) console.error(`  uncited: ${id} (empty/missing source)`)
  for (const id of report.stale) console.error(`  stale:   ${id} (reviewBy date has passed — re-verify source)`)
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
