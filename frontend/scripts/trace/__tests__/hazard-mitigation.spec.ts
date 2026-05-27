/**
 * Hazard mitigation gate — issue #267, deferred from v0.3.0-alpha release
 * audit PR-009. Fails the unit-test suite the moment any hazard in
 * `docs/risk_management/safety_hazards.md` loses its last non-deprecated
 * mitigating REQ.
 *
 * Pre-issue-#267 the safety-traceability chain looked complete on paper —
 * every REQ that mitigates a hazard carried a `FROM: @H-…@` reference and
 * shtracer's coverage gate was happy with the link count. But shtracer
 * didn't read REQ status. If the only REQ mitigating H-007 was later
 * marked `**Status:** Deprecated`, the hazard silently regressed to
 * *un-mitigated* with no signal anywhere.
 *
 * This spec inverts the chain: it walks the REQ scan, pulls each REQ's
 * status from the markdown body, and asserts that every declared H-tag
 * has at least one mitigating REQ in `Draft`/`Review`/`Approved`/
 * `Implemented` status. A `Deprecated` mitigator does not count — that is
 * the bug class issue #267 closes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildHazardInversion,
  findUnmitigatedHazards,
  statusAfter,
} from '../lib/hazard-status.mjs'
import { loadRegistryDir } from '../lib/registry.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')

describe('hazard mitigation status (issue #267)', () => {
  it('every declared hazard has at least one non-deprecated mitigating requirement', async () => {
    const { unmitigated, hazardIds } = await findUnmitigatedHazards(REPO_ROOT)
    if (unmitigated.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        '[hazard-gate] Un-mitigated hazard(s) detected — every H-xxx must trace ' +
          'to at least one REQ whose **Status:** is Draft / Review / Approved / ' +
          'Implemented. Deprecated mitigators are excluded by design (issue #267, ' +
          'release audit PR-009).\n' +
          JSON.stringify(unmitigated, null, 2),
      )
    }
    expect(unmitigated).toEqual([])
    expect(hazardIds.length).toBeGreaterThan(0)
  })

  it('inverts every active REQ→H reference into the hazard index', async () => {
    const { hazardToActiveReqs } = await buildHazardInversion(REPO_ROOT)
    // The hazard log declares H-001..H-019. Each one must surface in the
    // active inversion at least once, otherwise the test above would not
    // be able to distinguish "no REQ cites H-007" from "every REQ that
    // cites H-007 is Deprecated".
    for (let n = 1; n <= 19; n += 1) {
      const hazardId = `H-${String(n).padStart(3, '0')}`
      const reqs = hazardToActiveReqs.get(hazardId)
      expect(reqs?.size ?? 0, `${hazardId} must be mitigated by ≥1 active REQ`).toBeGreaterThan(0)
    }
  })

  it('the trace/hazards/hazards.yaml index agrees with the scanned reality', async () => {
    // The YAML is the machine-readable mirror of the markdown hazard log.
    // It cannot be allowed to drift — otherwise a curator could write
    // `mitigated_by: [REQ-DELETED-001]` and the gate would pass on the
    // YAML while the markdown was actually un-mitigated.
    const { hazardToActiveReqs } = await buildHazardInversion(REPO_ROOT)
    const files = await loadRegistryDir(REPO_ROOT, 'trace/hazards')
    expect(files.length, 'trace/hazards/ must contain at least one YAML registry file').toBeGreaterThan(0)
    const yamlEntries = files.flatMap((f) => f.entries)
    const yamlById = new Map(yamlEntries.map((e) => [e.id, e]))
    expect(yamlEntries.length).toBeGreaterThanOrEqual(19)
    for (const [hazardId, activeReqs] of hazardToActiveReqs.entries()) {
      const entry = yamlById.get(hazardId)
      expect(entry, `trace/hazards/ is missing an entry for ${hazardId}`).toBeTruthy()
      if (!entry) continue
      const declared = (entry.lists.mitigated_by ?? []).slice().sort()
      const actual = [...activeReqs].sort()
      expect(declared, `${hazardId} mitigated_by list disagrees with the scanned REQ→H inversion`).toEqual(actual)
      expect(entry.scalars.status, `${hazardId} must declare a status:`).toBeTruthy()
      expect(entry.scalars.severity, `${hazardId} must declare a severity:`).toBeTruthy()
    }
  })
})

describe('findUnmitigatedHazards (sandbox regression for the CI assertion)', () => {
  let sandbox: string

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'hazard-gate-'))
  })

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true })
  })

  async function writeSandboxFile(rel: string, contents: string): Promise<void> {
    const abs = path.join(sandbox, rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, contents)
  }

  it('flags a hazard whose only mitigating REQ is Deprecated', async () => {
    // Sandbox repo with one hazard mitigated by a single deprecated REQ —
    // exactly the regression class the gate exists to catch.
    await writeSandboxFile(
      'docs/risk_management/safety_hazards.md',
      [
        '# Hazard Log',
        '',
        '<!-- @H-007@ -->',
        '### H-007: Density altitude misjudgment',
        '',
        '**Severity:** S1',
        '',
      ].join('\n'),
    )
    await writeSandboxFile(
      'docs/requirements/performance.md',
      [
        '# Performance Requirements',
        '',
        '<!-- @REQ-PF-010@ (FROM: @H-007@) -->',
        '### REQ-PF-010: Density altitude awareness',
        '',
        '**Requirement:** Sample.',
        '**Priority:** P1',
        '**Status:** Deprecated',
        '',
      ].join('\n'),
    )

    const { unmitigated } = await findUnmitigatedHazards(sandbox)
    expect(unmitigated).toEqual([
      { hazardId: 'H-007', deprecatedMitigators: ['REQ-PF-010'] },
    ])
  })

  it('reports a hazard with NO mitigating REQ at all as un-mitigated', async () => {
    await writeSandboxFile(
      'docs/risk_management/safety_hazards.md',
      [
        '# Hazard Log',
        '',
        '<!-- @H-099@ -->',
        '### H-099: Orphan hazard',
        '',
      ].join('\n'),
    )

    const { unmitigated } = await findUnmitigatedHazards(sandbox)
    expect(unmitigated).toEqual([
      { hazardId: 'H-099', deprecatedMitigators: [] },
    ])
  })

  it('accepts a hazard mitigated by an Approved REQ — Deprecated siblings are ignored', async () => {
    // A pilot may be moving away from one REQ toward another. As long as
    // a non-Deprecated mitigator exists, the gate must stay green.
    await writeSandboxFile(
      'docs/risk_management/safety_hazards.md',
      [
        '<!-- @H-014@ -->',
        '### H-014: Crosswind limits',
        '',
      ].join('\n'),
    )
    await writeSandboxFile(
      'docs/requirements/weather.md',
      [
        '<!-- @REQ-WX-009@ (FROM: @H-014@) -->',
        '### REQ-WX-009: Crosswind notification',
        '',
        '**Status:** Approved',
        '',
        '<!-- @REQ-WX-099@ (FROM: @H-014@) -->',
        '### REQ-WX-099: Legacy crosswind logic',
        '',
        '**Status:** Deprecated',
        '',
      ].join('\n'),
    )

    const { unmitigated } = await findUnmitigatedHazards(sandbox)
    expect(unmitigated).toEqual([])
  })
})

describe('statusAfter — REQ status extraction', () => {
  it('returns the trimmed value of the **Status:** line within the lookahead window', () => {
    const lines = [
      '<!-- @REQ-AC-001@ -->',
      '',
      '### REQ-AC-001: Sample',
      '',
      '**Requirement:** The system shall …',
      '**Rationale:** Because.',
      '**Priority:** P1',
      '**Status:** Implemented',
      '**Design Reference:** n/a',
    ]
    expect(statusAfter(lines, 0)).toBe('Implemented')
  })

  it('recognises a Deprecated stub even when the REQ has no body', () => {
    const lines = [
      '### REQ-PF-014',
      '',
      '**Status:** Deprecated',
      '',
      '<!-- @REQ-PF-015@ (FROM: @H-008@) -->',
      '### REQ-PF-015: Runway Insufficient Notification',
    ]
    // The first line is the heading, so statusAfter from index 0 finds it.
    expect(statusAfter(lines, 0)).toBe('Deprecated')
  })

  it('returns null when no Status block is reachable inside the lookahead window', () => {
    const lines = ['### REQ-FAKE-001', '', 'Some prose without a status line.']
    expect(statusAfter(lines, 0)).toBeNull()
  })
})
