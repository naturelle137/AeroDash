// Serves the repo-root DISCLAIMER.md / LICENSE to the frontend (dev middleware
// + bundle asset) so the in-app disclaimer gate's full-text link resolves
// without keeping a drift-prone duplicate under public/. LICENSE is served as
// LICENSE.txt so it has an extension Workbox and browsers handle directly.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

interface LegalDoc {
  readonly source: string
  readonly urlPath: string
  readonly contentType: string
}

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
        res.setHeader('Cache-Control', 'no-cache')
        res.end(body)
      })
    },

    generateBundle() {
      for (const d of docs) {
        if (!existsSync(d.source)) {
          // Fail the build: the disclaimer gate's full-text link would 404 in
          // production, breaking the acknowledgement → full-text path.
          this.error(`Legal doc missing on disk: ${d.source}`)
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
