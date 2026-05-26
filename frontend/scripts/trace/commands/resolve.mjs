/**
 * `trace resolve` — replace `@TYPE@` placeholders with newly generated
 * sequential ids inferred from the source file's path.
 *
 * Files specified on the command line are loaded, rewritten in-place
 * (unless `--dry-run` is set), and the list of replacements is reported
 * to stdout. The first scan pass observes existing tags so the next-id
 * computation accounts for siblings already present in the same file.
 *
 * Segments are inferred per placeholder — a file containing both `@REQ@`
 * and `@IMP@` will format each with the correct segment shape rather
 * than reusing the first match's inference for every other type.
 */

import { readFile, writeFile } from 'node:fs/promises'

import { scanAll } from '../lib/parser.mjs'
import {
  placeholderProbeRegex,
  resolvePlaceholders,
} from '../lib/id-generator.mjs'
import { inferSegments } from '../lib/path-inference.mjs'
import { resolveCliFilePath } from '../lib/file-resolve.mjs'

/**
 * @param {Object} opts
 * @param {string} opts.repoRoot
 * @param {string[]} opts.files       Repo-relative or absolute paths.
 * @param {boolean} [opts.dryRun=false]
 * @param {(message: string) => void} [opts.log]
 */
export async function runResolve({ repoRoot, files, dryRun = false, log = () => {} }) {
  if (!files.length) {
    return { stdout: '', exitCode: 1, message: 'trace resolve: at least one file path required' }
  }

  const scan = await scanAll(repoRoot)
  /** @type {Array<{file: string, replacements: ReturnType<typeof resolvePlaceholders>['replacements']}>} */
  const summary = []

  for (const inputPath of files) {
    // Resolve against cwd FIRST so `pnpm trace` (which runs with
    // cwd=frontend/) finds `src/modules/…` under `frontend/src/modules/…`
    // and only falls back to a repo-root match when nothing exists under
    // cwd (review M3).
    const { absolute: abs, rel } = await resolveCliFilePath(inputPath, repoRoot)
    const text = await readFile(abs, 'utf8')
    if (!placeholderProbeRegex().test(text)) {
      log(`${rel}: no @TYPE@ placeholder found, skipping`)
      continue
    }
    // Path inference runs per placeholder so mixed-type files (e.g. a
    // `.spec.ts` that contains `@UT@` and an inline `@IMP@`) produce
    // structurally correct ids. Inference may throw when the path
    // doesn't expose enough structure — surface that to the caller.
    const { text: newText, replacements } = resolvePlaceholders({
      text,
      occurrences: scan.occurrences,
      segmentsFor: (type) => inferSegments(type, rel),
    })
    if (replacements.length === 0) continue
    summary.push({ file: rel, replacements })
    if (!dryRun) await writeFile(abs, newText, 'utf8')
  }

  for (const item of summary) {
    log(`${item.file}: ${item.replacements.map((r) => `${r.placeholder} → ${r.generated}`).join(', ')}`)
  }
  if (dryRun) log('(dry-run: no files were modified)')
  return { stdout: '', exitCode: 0, summary }
}
