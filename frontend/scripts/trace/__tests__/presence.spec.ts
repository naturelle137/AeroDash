import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildPresenceReport } from '../lib/presence.mjs'

// Repo-root anchor. `fileURLToPath` handles cross-platform path quirks
// that a raw `URL.pathname` does not — important on Windows hosts where
// the leading slash would otherwise survive into `path.resolve`. The
// file lives at frontend/scripts/trace/__tests__/presence.spec.ts, so
// repo root is four parent directories up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('registry presence (issue #264 / STC §4.2)', () => {
  it('exposes a YAML file for every module that declares a REQ tag', async () => {
    const report = await buildPresenceReport(REPO_ROOT)
    expect(report.missingRequirements, 'every REQ module must own a trace/requirements/{module}.yaml').toEqual([])
    expect(report.satisfiedRequirements.length).toBeGreaterThan(0)
  })

  it('exposes a YAML file for every phase that declares a UJ tag', async () => {
    const report = await buildPresenceReport(REPO_ROOT)
    expect(report.missingJourneys, 'every UJ phase must own a trace/journeys/{phase}.yaml').toEqual([])
    expect(report.satisfiedJourneys.length).toBeGreaterThan(0)
  })
})
