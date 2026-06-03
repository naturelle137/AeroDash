/**
 * Discover the source files in scope for the comment-discipline check.
 *
 * Scope: `frontend/src/**`, `frontend/scripts/**`, `frontend/tests/**`
 * — restricted to the file extensions that can hold the comment styles
 * the scanner understands (TS/JS line + block, Vue HTML + script).
 */

import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const SCOPE_DIRS = ['frontend/src', 'frontend/scripts', 'frontend/tests']

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.vue'])

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  'coverage',
  'stryker-tmp',
  '.features-gen',
  'playwright-report',
])

/**
 * @param {string} repoRoot
 * @returns {Promise<string[]>}  Repo-relative file paths, sorted.
 */
export async function discoverSourceFiles(repoRoot) {
  /** @type {string[]} */
  const out = []
  for (const dir of SCOPE_DIRS) {
    const abs = path.join(repoRoot, dir)
    await walk(abs, repoRoot, out)
  }
  return out.sort()
}

/**
 * @param {string} dir
 * @param {string} repoRoot
 * @param {string[]} out
 */
async function walk(dir, repoRoot, out) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(abs, repoRoot, out)
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!FILE_EXTENSIONS.has(ext)) continue
    const stats = await stat(abs)
    if (!stats.isFile()) continue
    out.push(path.relative(repoRoot, abs).split(path.sep).join('/'))
  }
}
