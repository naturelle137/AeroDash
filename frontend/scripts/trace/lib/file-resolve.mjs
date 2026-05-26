/**
 * Resolve a user-supplied file path the way developers actually type one.
 *
 * `pnpm trace tag/resolve --file <path>` runs from the user's terminal cwd,
 * but `pnpm trace` aliases through `pnpm --filter frontend run trace`, which
 * sets `cwd = <repo>/frontend/`. A developer tab-completing `src/modules/…`
 * from a `frontend/` terminal expects that to resolve to
 * `frontend/src/modules/…`, not the repo-root sibling `src/modules/…`
 * (which doesn't exist).
 *
 * Resolution strategy (review M3):
 *  1. Absolute path → use as-is.
 *  2. Relative path that exists under `cwd` → resolve there.
 *  3. Relative path that exists under `repoRoot` → resolve there.
 *  4. Otherwise default to `cwd`-relative and let the caller's `readFile`
 *     surface the ENOENT — the diagnostic includes both attempted paths.
 */

import { stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * @param {string} inputPath  As supplied on the command line.
 * @param {string} repoRoot
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<{absolute: string, rel: string, attempted: string[]}>}
 */
export async function resolveCliFilePath(inputPath, repoRoot, cwd = process.cwd()) {
  if (path.isAbsolute(inputPath)) {
    return {
      absolute: inputPath,
      rel: path.relative(repoRoot, inputPath).replace(/\\/g, '/'),
      attempted: [inputPath],
    }
  }
  const fromCwd = path.resolve(cwd, inputPath)
  const fromRoot = path.resolve(repoRoot, inputPath)
  const attempted = [fromCwd, fromRoot]

  if (await fileExists(fromCwd)) {
    return { absolute: fromCwd, rel: path.relative(repoRoot, fromCwd).replace(/\\/g, '/'), attempted }
  }
  if (fromRoot !== fromCwd && await fileExists(fromRoot)) {
    return { absolute: fromRoot, rel: path.relative(repoRoot, fromRoot).replace(/\\/g, '/'), attempted }
  }
  // Neither exists — return the cwd-relative form so the eventual ENOENT
  // matches what the developer typed, and surface both attempted paths in
  // the CLI's error message via `attempted`.
  return { absolute: fromCwd, rel: path.relative(repoRoot, fromCwd).replace(/\\/g, '/'), attempted }
}

async function fileExists(p) {
  try {
    const meta = await stat(p)
    return meta.isFile()
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return false
    throw err
  }
}
