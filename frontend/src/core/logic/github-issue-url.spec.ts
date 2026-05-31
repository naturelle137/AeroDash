// @UT-SYS-CORE-102@ (FROM: @IMP-SYS-CORE-013@)
import { describe, it, expect } from 'vitest'
import {
  buildBugReportUrl,
  buildFeatureRequestUrl,
  BUG_REPORT_TEMPLATE,
  FEATURE_REQUEST_TEMPLATE,
  GITHUB_NEW_ISSUE_URL,
  GITHUB_SECURITY_ADVISORY_URL,
  GITHUB_REPO_URL,
  GITHUB_ISSUES_URL,
  BUG_SEVERITY_VALUES,
  type BugReportInput,
  type FeatureRequestInput,
} from './github-issue-url'

function parseQuery(url: string): URLSearchParams {
  const q = url.split('?')[1] ?? ''
  return new URLSearchParams(q)
}

const validBug: BugReportInput = {
  title: 'CG indicator stays green after MTOM breach',
  description: 'After loading 4 PAX the indicator stays green even though the total mass is above MTOM.',
  reproduction:
    '1. Open Mass & Balance.\n2. Pick the C172 test profile.\n3. Set front row to 90 kg each.\n4. Set rear row to 90 kg each.\n5. Add full fuel.',
  severity: 'CRITICAL: Incorrect calculations/data (Safety Hazard!)',
  environment: 'iPad Air, Safari 17, iPadOS 17.4',
}

const validFeature: FeatureRequestInput = {
  title: 'Wind correction on runway diagram',
  problem: 'As a pilot, I want to see crosswind on the runway diagram so that I can pick a runway visually.',
  solution: 'Render a wind arrow overlay on the runway diagram, scaled by speed.',
  dod: '- [ ] Arrow renders when wind is known\n- [ ] Arrow hidden when wind unknown',
}

describe('buildBugReportUrl', () => {
  it('builds a URL that targets the bug_report template at the new-issue endpoint', () => {
    const url = buildBugReportUrl(validBug)
    expect(url.startsWith(`${GITHUB_NEW_ISSUE_URL}?`)).toBe(true)
    const q = parseQuery(url)
    expect(q.get('template')).toBe(BUG_REPORT_TEMPLATE)
  })

  it('prefills title and every required text field under its GitHub template id', () => {
    const url = buildBugReportUrl(validBug)
    const q = parseQuery(url)
    expect(q.get('title')).toBe(validBug.title)
    expect(q.get('description')).toBe(validBug.description)
    expect(q.get('reproduction')).toBe(validBug.reproduction)
    expect(q.get('severity')).toBe(validBug.severity)
    expect(q.get('environment')).toBe(validBug.environment)
  })

  it('omits hazard_ref when absent or empty', () => {
    const url = buildBugReportUrl(validBug)
    expect(parseQuery(url).has('hazard_ref')).toBe(false)

    const withBlank = buildBugReportUrl({ ...validBug, hazard_ref: '   ' })
    expect(parseQuery(withBlank).has('hazard_ref')).toBe(false)
  })

  it('includes hazard_ref when provided non-empty', () => {
    const url = buildBugReportUrl({ ...validBug, hazard_ref: 'H-014' })
    expect(parseQuery(url).get('hazard_ref')).toBe('H-014')
  })

  it.each(BUG_SEVERITY_VALUES.map((v) => [v]))(
    'accepts the exact severity option label %s',
    (severity) => {
      const url = buildBugReportUrl({ ...validBug, severity })
      expect(parseQuery(url).get('severity')).toBe(severity)
    },
  )

  it.each([
    ['title', { ...validBug, title: '' }],
    ['title (whitespace)', { ...validBug, title: '   ' }],
    ['description', { ...validBug, description: '' }],
    ['reproduction', { ...validBug, reproduction: '' }],
    ['severity', { ...validBug, severity: '' as unknown as BugReportInput['severity'] }],
    ['environment', { ...validBug, environment: '' }],
  ])('throws when required field %s is empty', (_label, input) => {
    expect(() => buildBugReportUrl(input)).toThrow(/required field/)
  })

  it('truncates the longest field with a marker when the URL exceeds the GitHub limit', () => {
    const huge = 'A'.repeat(12000)
    const url = buildBugReportUrl({ ...validBug, description: huge })
    expect(url.length).toBeLessThanOrEqual(7500)
    const q = parseQuery(url)
    expect(q.get('template')).toBe(BUG_REPORT_TEMPLATE)
    expect(q.get('title')).toBe(validBug.title)
    expect(q.get('description') ?? '').toMatch(/… \(truncated\)$/)
  })

  it('falls back to title-only when no body field can fit alongside an oversize title', () => {
    // The trim loop strips body fields one at a time. When the title alone
    // already pushes the URL over the GitHub limit, even after every body
    // field has been shrunk or dropped the URL is still over budget — the
    // loop then exits via the title-only fallback (only template + title
    // survive). The fallback URL may itself exceed the limit (best-effort
    // hand-off — the form layer is supposed to cap title length upstream),
    // so we don't assert URL length here; the contract under test is "no
    // body-field query params on this code path".
    const monsterTitle = 'A'.repeat(7600)
    const url = buildBugReportUrl({ ...validBug, title: monsterTitle })
    const q = parseQuery(url)
    expect(q.get('template')).toBe(BUG_REPORT_TEMPLATE)
    expect(q.get('title')).toBe(monsterTitle)
    expect(q.has('description')).toBe(false)
    expect(q.has('reproduction')).toBe(false)
    expect(q.has('severity')).toBe(false)
    expect(q.has('environment')).toBe(false)
    expect(q.has('hazard_ref')).toBe(false)
  })
})

describe('buildFeatureRequestUrl', () => {
  it('targets the feature_request template at the new-issue endpoint', () => {
    const url = buildFeatureRequestUrl(validFeature)
    expect(url.startsWith(`${GITHUB_NEW_ISSUE_URL}?`)).toBe(true)
    expect(parseQuery(url).get('template')).toBe(FEATURE_REQUEST_TEMPLATE)
  })

  it('prefills title and every required field under its GitHub template id', () => {
    const url = buildFeatureRequestUrl(validFeature)
    const q = parseQuery(url)
    expect(q.get('title')).toBe(validFeature.title)
    expect(q.get('problem')).toBe(validFeature.problem)
    expect(q.get('solution')).toBe(validFeature.solution)
    expect(q.get('dod')).toBe(validFeature.dod)
  })

  it('omits req_id and safety_impact when absent or empty', () => {
    const url = buildFeatureRequestUrl(validFeature)
    const q = parseQuery(url)
    expect(q.has('req_id')).toBe(false)
    expect(q.has('safety_impact')).toBe(false)
  })

  it('includes req_id and safety_impact when provided', () => {
    const url = buildFeatureRequestUrl({
      ...validFeature,
      req_id: 'REQ-PF-001',
      safety_impact: 'Could affect runway selection.',
    })
    const q = parseQuery(url)
    expect(q.get('req_id')).toBe('REQ-PF-001')
    expect(q.get('safety_impact')).toBe('Could affect runway selection.')
  })

  it.each([
    ['title', { ...validFeature, title: '' }],
    ['problem', { ...validFeature, problem: '' }],
    ['solution', { ...validFeature, solution: '' }],
    ['dod', { ...validFeature, dod: '' }],
  ])('throws when required field %s is empty', (_label, input) => {
    expect(() => buildFeatureRequestUrl(input)).toThrow(/required field/)
  })

  it('respects the URL length cap with a long DoD list', () => {
    const long = '- [ ] item\n'.repeat(2000)
    const url = buildFeatureRequestUrl({ ...validFeature, dod: long })
    expect(url.length).toBeLessThanOrEqual(7500)
    expect(parseQuery(url).get('template')).toBe(FEATURE_REQUEST_TEMPLATE)
  })
})

describe('exported endpoints', () => {
  it('points security advisories at the private advisory form on the repo', () => {
    expect(GITHUB_SECURITY_ADVISORY_URL).toBe(`${GITHUB_REPO_URL}/security/advisories/new`)
  })

  it('points the public issue list at /issues', () => {
    expect(GITHUB_ISSUES_URL).toBe(`${GITHUB_REPO_URL}/issues`)
  })
})
