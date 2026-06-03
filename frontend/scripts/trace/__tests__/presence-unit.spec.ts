import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildPresenceReport } from '../lib/presence.mjs'

// STC §4.2 — registry presence is a hard requirement, not
// best-effort. These tests pin the contract on a sandbox so regressions
// surface independently of the real repo state covered by
// `presence.spec.ts`.

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(os.tmpdir(), 'trace-presence-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

async function write(rel: string, contents: string): Promise<void> {
  const abs = path.join(sandbox, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, contents)
}

describe('buildPresenceReport', () => {
  it('flags every REQ module without a registry YAML', async () => {
    await write('docs/requirements/mass_balance.md', '<!-- @REQ-MB-001@ -->\n### REQ-MB-001: t\n')
    await write('docs/requirements/performance.md', '<!-- @REQ-PF-001@ -->\n### REQ-PF-001: t\n')
    // Only mb.yaml exists — pf.yaml should be reported missing.
    await write('trace/requirements/mb.yaml', 'Mass & Balance Requirements\n  REQ-MB-001\n    title: t\n')

    const report = await buildPresenceReport(sandbox)
    expect(report.missingRequirements.map((m) => m.key)).toEqual(['pf'])
    expect(report.satisfiedRequirements.map((m) => m.key)).toEqual(['mb'])
    expect(report.missingRequirements[0].relPath).toBe('trace/requirements/pf.yaml')
    expect(report.missingRequirements[0].sourceIds).toEqual(['REQ-PF-001'])
  })

  it('flags every UJ phase without a registry YAML', async () => {
    await write('docs/journeys/01_fleet_management.md', '<!-- @UJ-A-001@ -->\n## UJ-A-001: t\n')
    await write('docs/journeys/02_flight_preparation.md', '<!-- @UJ-B-001@ -->\n## UJ-B-001: t\n')
    await write('trace/journeys/a.yaml', 'Phase A\n  UJ-A-001\n    title: t\n')

    const report = await buildPresenceReport(sandbox)
    expect(report.missingJourneys.map((m) => m.key)).toEqual(['b'])
    expect(report.satisfiedJourneys.map((m) => m.key)).toEqual(['a'])
  })

  it('returns empty missing lists when every module/phase has a registry', async () => {
    await write('docs/requirements/mass_balance.md', '<!-- @REQ-MB-001@ -->\n### REQ-MB-001: t\n')
    await write('docs/journeys/01_fleet_management.md', '<!-- @UJ-A-001@ -->\n## UJ-A-001: t\n')
    await write('trace/requirements/mb.yaml', 'Mass & Balance Requirements\n  REQ-MB-001\n    title: t\n')
    await write('trace/journeys/a.yaml', 'Phase A\n  UJ-A-001\n    title: t\n')

    const report = await buildPresenceReport(sandbox)
    expect(report.missingRequirements).toEqual([])
    expect(report.missingJourneys).toEqual([])
  })

  it('returns empty when no source REQ/UJ tags exist (vacuously satisfied)', async () => {
    const report = await buildPresenceReport(sandbox)
    expect(report.missingRequirements).toEqual([])
    expect(report.satisfiedRequirements).toEqual([])
    expect(report.missingJourneys).toEqual([])
    expect(report.satisfiedJourneys).toEqual([])
  })
})
