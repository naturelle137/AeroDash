/**
 * Vite plugin that exposes the canonical `DISCLAIMER.md` and `LICENSE` files
 * from the repository root to the served frontend.
 *
 * Why this lives in a plugin and not in `public/`:
 * - `DISCLAIMER.md` and `LICENSE` are the authoritative legal artifacts and
 *   live at repo root. Maintaining a duplicate under `frontend/public/` would
 *   silently drift; an aviation liability boundary cannot tolerate that drift.
 * - REQ-SYS-016 (the in-app disclaimer acknowledgement gate, audit PR-016)
 *   surfaces a link to the full text. If that link 404s in production the
 *   pilot cannot verify what they consented to.
 *
 * The plugin:
 * - In `dev` mode, installs a tiny middleware so `/DISCLAIMER.md` and
 *   `/LICENSE.txt` are served from the repo root with no copy on disk.
 * - In `build` mode, emits both files into the bundle so the linked URLs
 *   resolve from the deployed PWA.
 *
 * The LICENSE file is renamed to `LICENSE.txt` in the served path because
 * (a) the original has no extension, which makes Workbox glob inclusion and
 * MIME-type handling awkward, and (b) browsers render `.txt` directly.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

interface LegalDoc {
  /** Path on disk relative to the repository root. */
  readonly source: string
  /** URL path the file is served at (always absolute, leading slash). */
  readonly urlPath: string
  /** `Content-Type` header value for dev-server responses. */
  readonly contentType: string
}

/**
 * @param repoRoot - Absolute path to the repository root. Defaults to the
 *   parent of the frontend workspace (i.e. two levels up from this file).
 */
export function copyLegalDocs(repoRoot?: string): Plugin {
  const root = repoRoot ?? resolve(fileURLToPath(new URL('../../../', import.meta.url)))
  const docs: ReadonlyArray<LegalDoc> = [
    {
      source: resolve(root, 'DISCLAIMER.md'),
      urlPath: '/DISCLAIMER.md',
      contentType: 'text/markdown; charset=utf-8',
    },
    {
      source: resolve(root, 'LICENSE'),
      urlPath: '/LICENSE.txt',
      contentType: 'text/plain; charset=utf-8',
    },
  ]

  return {
    name: 'aerodash:copy-legal-docs',
    apply: () => true,

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const url = req.url.split('?')[0]
        const match = docs.find((d) => d.urlPath === url)
        if (!match) return next()
        if (!existsSync(match.source)) return next()
        const body = readFileSync(match.source)
        res.statusCode = 200
        res.setHeader('Content-Type', match.contentType)
        res.setHeader('Cache-Control', 'no-cache')
        res.end(body)
      })
    },

    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const url = req.url.split('?')[0]
        const match = docs.find((d) => d.urlPath === url)
        if (!match) return next()
        if (!existsSync(match.source)) return next()
        const body = readFileSync(match.source)
        res.statusCode = 200
        res.setHeader('Content-Type', match.contentType)
        res.end(body)
      })
    },

    generateBundle() {
      for (const d of docs) {
        if (!existsSync(d.source)) {
          this.warn(`Legal doc missing on disk: ${d.source}`)
          continue
        }
        this.emitFile({
          type: 'asset',
          fileName: d.urlPath.replace(/^\//, ''),
          source: readFileSync(d.source),
        })
      }
    },
  }
}
