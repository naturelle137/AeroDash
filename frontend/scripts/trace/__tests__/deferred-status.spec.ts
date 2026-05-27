/**
 * Deferred-status coverage gate — issue #269, deferred from v0.3.0-alpha
 * release audit PR-017. Asserts the two safety contracts the `Deferred`
 * lifecycle relies on:
 *
 *   1. **Coverage exclusion.** A REQ marked `Status: Deferred` is
 *      excluded from the release-readiness `pendingReqs` tally — the
 *      audit signal must not be bloated by out-of-scope work that the
 *      project has truthfully labelled as such. `Deprecated` REQs are
 *      excluded for the same reason.
 *   2. **Hazard chain preservation.** A `Deferred` REQ is still a
 *      planned safety control: it must continue to count as an active
 *      mitigator so the hazard chain does not silently regress to
 *      un-mitigated the moment a mitigating REQ is descoped from the
 *      current release. Only `Deprecated` REQs forfeit hazard-mitigation
 *      credit (issue #267).
 *
 * The spec exercises a sandboxed mini-repo through `buildCheckReport`
 * and `findUnmitigatedHazards` so the assertions trace the same code
 * path that `pnpm trace check` runs in CI.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ACTIVE_STATUSES,
  DEFERRED_STATUS,
  DEPRECATED_STATUS,
  buildHazardInversion,
  findUnmitigatedHazards,
  isCoverageExcludedStatus,
  loadReqStatuses,
} from '../lib/hazard-status.mjs'
import { buildCheckReport } from '../commands/check.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..')

describe('isCoverageExcludedStatus', () => {
  it('excludes Deferred (issue #269) and Deprecated (issue #267) from coverage tallies', () => {
    expect(isCoverageExcludedStatus(DEFERRED_STATUS)).toBe(true)
    expect(isCoverageExcludedStatus(DEPRECATED_STATUS)).toBe(true)
  })

  it('treats every active status as in-scope for release-readiness coverage', () => {
    for (const status of ['Draft', 'Review', 'Approved', 'Implemented']) {
      expect(isCoverageExcludedStatus(status), `${status} must count toward coverage`).toBe(false)
    }
  })

  it('treats unknown / missing status conservatively (in-scope)', () => {
    // A missing status is "unknown", which must NOT silently shave a
    // REQ off the audit signal. Only the explicit Deferred/Deprecated
    // markers exclude.
    expect(isCoverageExcludedStatus(undefined)).toBe(false)
    expect(isCoverageExcludedStatus(null)).toBe(false)
    expect(isCoverageExcludedStatus('')).toBe(false)
    expect(isCoverageExcludedStatus('Mystery')).toBe(false)
  })

  it('includes Deferred as an ACTIVE status for hazard mitigation', () => {
    // A Deferred REQ is a planned (but not-yet-scheduled) safety
    // control. Excluding it from the active set would silently
    // regress the hazard chain the moment a mitigator is descoped —
    // the failure mode that issue #269 explicitly does NOT introduce.
    expect(ACTIVE_STATUSES.has(DEFERRED_STATUS)).toBe(true)
  })
})

describe('Deferred coverage gate (sandbox regression for issue #269)', () => {
  let sandbox: string

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'deferred-gate-'))
  })

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true })
  })

  async function writeSandboxFile(rel: string, contents: string): Promise<void> {
    const abs = path.join(sandbox, rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, contents)
  }

  async function writeMinimalScannerScaffold(): Promise<void> {
    // The trace scanner walks several top-level dirs by default; a
    // sandbox needs only the docs/ trees the assertions touch, but
    // unconditionally provide an empty trace/ root so registry-presence
    // checks don't tip the gate over for unrelated reasons.
    await mkdir(path.join(sandbox, 'trace'), { recursive: true })
  }

  it('excludes a Deferred REQ from the pending coverage list', async () => {
    await writeMinimalScannerScaffold()
    await writeSandboxFile(
      'docs/requirements/weather.md',
      [
        '# Weather',
        '',
        '<!-- @REQ-WX-001@ -->',
        '### REQ-WX-001: METAR/TAF Retrieval',
        '',
        '**Requirement:** Sample.',
        '**Priority:** P2',
        '**Status:** Deferred',
        '',
        '<!-- @REQ-WX-002@ -->',
        '### REQ-WX-002: Wind Components Calculation',
        '',
        '**Requirement:** Sample.',
        '**Priority:** P2',
        '**Status:** Approved',
        '',
      ].join('\n'),
    )

    const report = await buildCheckReport(sandbox)
    expect(report.reqCoverage.excludedReqs).toContain('REQ-WX-001')
    expect(report.reqCoverage.pendingReqs).toContain('REQ-WX-002')
    expect(report.reqCoverage.pendingReqs).not.toContain('REQ-WX-001')
    expect(report.reqCoverage.statusByReq['REQ-WX-001']).toBe('Deferred')
    expect(report.reqCoverage.statusByReq['REQ-WX-002']).toBe('Approved')
  })

  it('keeps an Approved REQ in the pending list when no downstream IMP exists', async () => {
    await writeMinimalScannerScaffold()
    await writeSandboxFile(
      'docs/requirements/airport.md',
      [
        '<!-- @REQ-AP-099@ -->',
        '### REQ-AP-099: Sandbox-only requirement',
        '',
        '**Status:** Approved',
        '',
      ].join('\n'),
    )

    const report = await buildCheckReport(sandbox)
    expect(report.reqCoverage.pendingReqs).toContain('REQ-AP-099')
    expect(report.reqCoverage.excludedReqs).not.toContain('REQ-AP-099')
  })

  it('removes a REQ from the pending list once an IMP citation exists', async () => {
    await writeMinimalScannerScaffold()
    await writeSandboxFile(
      'docs/requirements/system.md',
      [
        '<!-- @REQ-SYS-099@ -->',
        '### REQ-SYS-099: Sandbox-implemented requirement',
        '',
        '**Status:** Approved',
        '',
      ].join('\n'),
    )
    await writeSandboxFile(
      'frontend/src/modules/sys/foo.ts',
      '// @IMP-SYS-CORE-001@ (FROM: @REQ-SYS-099@)\nexport const x = 1\n',
    )

    const report = await buildCheckReport(sandbox)
    expect(report.reqCoverage.pendingReqs).not.toContain('REQ-SYS-099')
    expect(report.reqCoverage.excludedReqs).not.toContain('REQ-SYS-099')
  })

  it('treats a Deferred REQ as an ACTIVE hazard mitigator (preserves the safety chain)', async () => {
    // Single-mitigator hazard whose REQ is descoped to Deferred — the
    // gate MUST stay green because the planned safety control still
    // exists, even though it is not implementing in the current cycle.
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
        '### REQ-WX-009: Wind Limit Exceedance Notification',
        '',
        '**Status:** Deferred',
        '',
      ].join('\n'),
    )

    const { unmitigated } = await findUnmitigatedHazards(sandbox)
    expect(unmitigated).toEqual([])

    const inversion = await buildHazardInversion(sandbox)
    const reqs = inversion.hazardToActiveReqs.get('H-014')
    expect(reqs?.has('REQ-WX-009')).toBe(true)
  })
})

describe('Deferred coverage gate (live repo regression for issue #269)', () => {
  it('marks every Deferred REQ found in docs/requirements/ as coverage-excluded', async () => {
    // The live audit signal: every REQ this PR pushed to Deferred must
    // appear in the excluded list, and none of them may bleed back into
    // the "pending" tally — otherwise the audit metric is silently
    // bloated again.
    const statuses = await loadReqStatuses(REPO_ROOT)
    const deferred = [...statuses.entries()]
      .filter(([, s]) => s === DEFERRED_STATUS)
      .map(([id]) => id)
      .sort()
    expect(deferred.length, 'at least one REQ must be marked Deferred per issue #269').toBeGreaterThan(0)

    const report = await buildCheckReport(REPO_ROOT)
    for (const id of deferred) {
      expect(
        report.reqCoverage.excludedReqs,
        `${id} (Status: Deferred) must appear in reqCoverage.excludedReqs`,
      ).toContain(id)
      expect(
        report.reqCoverage.pendingReqs,
        `${id} (Status: Deferred) must NOT appear in reqCoverage.pendingReqs`,
      ).not.toContain(id)
    }
  })

  it('does not regress the hazard-mitigation chain (Deferred mitigators still count)', async () => {
    const { unmitigated } = await findUnmitigatedHazards(REPO_ROOT)
    expect(unmitigated).toEqual([])
  })
})
