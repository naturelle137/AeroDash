#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * `trace` — AeroDash traceability authoring CLI.
 *
 * Usage:
 *   trace parse                              # dump scanned tag graph as JSON
 *   trace check [--warn-only]                # invariant + drift validation
 *   trace tag <TYPE> [--module M] [--layer L] [--phase P] [--from REQ-…,…] \
 *                    [--file path] [--line N] [--technical] [--dry-run]
 *   trace resolve <files...> [--dry-run]     # rewrite @TYPE@ placeholders
 *   trace sync [--apply]                     # regenerate trace/ registries
 *
 * The CLI is intentionally flag-driven so it works inside CI without a TTY.
 * Local devs may invoke `trace tag IMP` and be prompted for missing values
 * — see CONTRIBUTING.md for the interactive walk-through.
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { runCheck } from './commands/check.mjs'
import { runParse } from './commands/parse.mjs'
import { runResolve } from './commands/resolve.mjs'
import { runSync } from './commands/sync.mjs'
import { runTag } from './commands/tag.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// scripts/trace/index.mjs → repo root is three levels up.
const DEFAULT_REPO_ROOT = path.resolve(HERE, '..', '..', '..')

/**
 * Lightweight argv parser. Splits positional args from `--flag` and
 * `--flag=value` / `--flag value` tokens. Booleans are detected when the
 * next token starts with `--` (or doesn't exist).
 *
 * @param {string[]} argv
 * @returns {{ positionals: string[], flags: Record<string, string|boolean|string[]> }}
 */
export function parseArgv(argv) {
  /** @type {string[]} */
  const positionals = []
  /** @type {Record<string, string|boolean|string[]>} */
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const eqIdx = token.indexOf('=')
    if (eqIdx !== -1) {
      flags[token.slice(2, eqIdx)] = token.slice(eqIdx + 1)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true
    } else {
      flags[key] = next
      i += 1
    }
  }
  return { positionals, flags }
}

/**
 * Convert a comma-separated `--from REQ-MB-001,REQ-MB-002` value into the
 * canonical `@REQ-MB-001@` shape the parser expects. Accepts either bare
 * or `@…@` ids.
 *
 * @param {string|boolean|string[]} raw
 * @returns {string[]}
 */
function parseFromTags(raw) {
  if (raw == null || raw === true || raw === false) return []
  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('@') ? s : `@${s}@`))
}

/**
 * Dispatch a subcommand against the parsed argv. Exposed for unit tests.
 *
 * @param {string[]} argv
 * @param {Object} [ctx]
 * @param {string} [ctx.repoRoot]
 * @param {(message: string) => void} [ctx.log]
 * @param {(message: string) => void} [ctx.write]
 */
export async function run(argv, ctx = {}) {
  const { repoRoot = DEFAULT_REPO_ROOT, log = (m) => console.log(m), write = (m) => process.stdout.write(m) } = ctx
  const { positionals, flags } = parseArgv(argv)
  const [command, ...rest] = positionals

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h': {
      log(
        [
          'trace — AeroDash traceability CLI',
          '',
          'Commands:',
          '  parse                    Dump scanned tags as JSON',
          '  check [--warn-only]      Validate invariants + registry drift',
          '  tag <TYPE> --file <p>    Generate and insert the next tag id',
          '  resolve <files...>       Replace @TYPE@ placeholders',
          '  sync [--apply]           Regenerate trace/ registries',
          '',
          'trace tag segment precedence (highest → lowest):',
          '  1. positional segments (`trace tag IMP MB CORE --file …`)',
          '  2. `--module`/`--layer`/`--phase` flags',
          '  3. inference from the --file path',
        ].join('\n'),
      )
      return 0
    }
    case 'parse': {
      const { stdout, exitCode } = await runParse({ repoRoot, log })
      write(stdout)
      return exitCode
    }
    case 'check': {
      const { exitCode } = await runCheck({
        repoRoot,
        log,
        warnOnly: Boolean(flags['warn-only']),
      })
      return exitCode
    }
    case 'tag': {
      const [type, ...segments] = rest
      if (!type) throw new Error('trace tag: TYPE positional is required')
      const file = flags.file ? String(flags.file) : undefined
      if (!file) throw new Error('trace tag: --file is required')
      const segmentList = segments.length > 0
        ? segments.map((s) => s.toUpperCase())
        : flags.module || flags.layer || flags.phase
          ? [flags.module, flags.layer, flags.phase].filter(Boolean).map((s) => String(s).toUpperCase())
          : undefined
      const fromTags = parseFromTags(flags.from)
      const technical = Boolean(flags.technical)
      const dryRun = Boolean(flags['dry-run'])
      const lineIndex = flags.line ? Number(flags.line) : undefined
      const { exitCode } = await runTag({
        repoRoot,
        type: /** @type {any} */ (type.toUpperCase()),
        file,
        segments: segmentList,
        fromTags,
        technical,
        lineIndex,
        dryRun,
        log,
      })
      return exitCode
    }
    case 'resolve': {
      const dryRun = Boolean(flags['dry-run'])
      const { exitCode } = await runResolve({ repoRoot, files: rest, dryRun, log })
      return exitCode
    }
    case 'sync': {
      const apply = Boolean(flags.apply)
      const typesFlag = flags.types ? String(flags.types).split(',') : undefined
      const { exitCode } = await runSync({
        repoRoot,
        apply,
        types: /** @type {any} */ (typesFlag),
        log,
      })
      return exitCode
    }
    default:
      throw new Error(`Unknown subcommand: ${command}`)
  }
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
})()

if (invokedDirectly) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exit(code)
    })
    .catch((err) => {
      console.error(err.message ?? err)
      process.exit(1)
    })
}
