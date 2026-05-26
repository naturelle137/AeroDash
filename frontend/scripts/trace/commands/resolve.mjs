/**
 * `trace resolve` — replace `@TYPE@` placeholders with newly generated
 * sequential ids inferred from the source file's path.
 *
 * Files specified on the command line are loaded, rewritten in-place
 * (unless `--dry-run` is set), and the list of replacements is reported
 * to stdout. The first scan pass observes existing tags so the next-id
 * computation accounts for siblings already present in the same file.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { scanAll } from '../lib/parser.mjs'
import { resolvePlaceholders } from '../lib/id-generator.mjs'
import { inferSegments } from '../lib/path-inference.mjs'

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
    const abs = path.isAbsolute(inputPath) ? inputPath : path.join(repoRoot, inputPath)
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/')
    const text = await readFile(abs, 'utf8')
    const placeholderMatch = /@(H|REQ|UJ|DES|IMP|UT|IT|E2E)@/.exec(text)
    if (!placeholderMatch) {
      log(`${rel}: no @TYPE@ placeholder found, skipping`)
      continue
    }
    // Infer segments once per file. We rely on path inference, which
    // throws when the file doesn't expose enough structure to pick a
    // module/layer/phase. The caller can pre-edit the file to add a
    // narrower path, or run trace tag instead.
    const type = /** @type {import('../lib/config.mjs').TagType} */ (placeholderMatch[1])
    const segments = inferSegments(type, rel)
    const { text: newText, replacements } = resolvePlaceholders({
      text,
      occurrences: scan.occurrences,
      segments,
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
