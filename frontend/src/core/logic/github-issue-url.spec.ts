// @UT-SYS-CORE-111@ (FROM: @IMP-SYS-CORE-015@)
import { describe, it, expect } from 'vitest'
import {
  GITHUB_URL_MAX_LEN,
  INCIDENT_KIND_LABELS,
  TEMPLATE_FILE,
  TITLE_PREFIX,
  buildGithubIssueUrl,
  renderIncidentBody,
  renderIncidentContext,
} from './github-issue-url'
import type { IncidentReport } from '../domain/incident-report.schema'

function buildReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    createdAt: '2026-05-31T08:15:00.000Z',
    kind: 'CALCULATION',
    summary: 'CG amber after correct fuel entry',
    redactedDescription: 'Loaded 100 kg pilot mass and 50 L fuel; envelope went amber.',
    context: {
      appVersion: '0.4.0-alpha',
      routeName: 'mass-balance',
      pathTail: 'mass-balance',
      userAgent: 'Mozilla/5.0',
      online: true,
    },
    schemaVersion: 1,
    ...overrides,
  }
}

describe('buildGithubIssueUrl', () => {
  it('targets the repo issues/new endpoint with the incident template', () => {
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport(),
    })
    expect(url.startsWith('https://github.com/owner/repo/issues/new?')).toBe(true)
    expect(url).toContain(`template=${TEMPLATE_FILE}`)
  })

  it('prefixes the title and url-encodes the summary', () => {
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport({ summary: 'CG amber after correct fuel entry & reload' }),
    })
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain(`title=${TITLE_PREFIX} CG amber after correct fuel entry & reload`)
  })

  it('encodes the kind as its human-readable label', () => {
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport({ kind: 'CRASH' }),
    })
    expect(decodeURIComponent(url)).toContain(`kind=${INCIDENT_KIND_LABELS.CRASH}`)
  })

  it('embeds the redacted body and the operational context separately', () => {
    const report = buildReport()
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report,
    })
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain(renderIncidentBody(report))
    expect(decoded).toContain(renderIncidentContext(report))
  })

  it('tolerates a trailing slash on the repo URL', () => {
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo/',
      report: buildReport(),
    })
    expect(url).toContain('/repo/issues/new?')
    expect(url).not.toContain('/repo//issues/new')
  })

  it('stays under the GitHub URL length cap by truncating the description', () => {
    const huge = 'X'.repeat(50_000)
    const url = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport({ redactedDescription: huge }),
    })
    expect(url.length).toBeLessThanOrEqual(GITHUB_URL_MAX_LEN)
    expect(decodeURIComponent(url)).toContain('…[truncated; open the saved report on the device for the full text]')
  })

  it('is deterministic — same input yields identical output', () => {
    const a = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport(),
    })
    const b = buildGithubIssueUrl({
      repoUrl: 'https://github.com/owner/repo',
      report: buildReport(),
    })
    expect(a).toBe(b)
  })
})

describe('renderIncidentContext', () => {
  it('renders unknown route/userAgent/online states as "unknown"', () => {
    const out = renderIncidentContext(
      buildReport({
        context: {
          appVersion: '0.4.0-alpha',
          routeName: null,
          pathTail: null,
          userAgent: null,
          online: null,
        },
      }),
    )
    expect(out).toContain('Route:** unknown')
    expect(out).toContain('Online:** unknown')
    expect(out).toContain('User agent:** unknown')
  })
})
